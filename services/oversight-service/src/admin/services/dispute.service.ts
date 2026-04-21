import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { DisputeRepository, DisputeMessage } from "../repositories/dispute.repository";
import { AdminActionRepository } from "../repositories/admin-action.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { Dispute } from "../entities/dispute.entity";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";
import { DisputeListQueryDto } from "../dto/dispute-list-query.dto";
import {
  resolvePagination,
  validateDateRange,
} from "../../common/pagination/list-query-validation.util";
import { KafkaService } from "../../kafka/kafka.service";
import { NotificationClient } from "../../common/notification/notification.client";
import { UserClient } from "../../common/user/user.client";
import { CacheInvalidationService } from "../../common/services/cache-invalidation.service";
import { BroadcastService } from "../../common/services/broadcast.service";

// Valid status transitions: current → allowed next statuses
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["investigating", "escalated"],
  investigating: ["escalated", "resolved", "closed"],
  escalated: ["investigating", "resolved", "closed"],
  resolved: ["closed"],
  closed: [],
};

@Injectable()
export class DisputeService {
  private readonly workersEnabled: boolean;

  constructor(
    private readonly disputeRepository: DisputeRepository,
    private readonly adminActionRepository: AdminActionRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly kafkaService: KafkaService,
    private readonly notificationClient: NotificationClient,
    private readonly userClient: UserClient,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly broadcastService: BroadcastService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    @InjectQueue("oversight.notification")
    private readonly notificationQueue: Queue,
  ) {
    this.workersEnabled = process.env.WORKERS_ENABLED === "true";
  }

  async createDispute(
    jobId: string,
    openedBy: string,
    reason: string,
    description?: string,
    evidenceImages?: { id: string; url: string }[],
  ): Promise<Dispute> {
    this.logger.log(
      `Creating dispute for job ${jobId} by user ${openedBy}`,
      "DisputeService",
    );

    // Enforce dispute window: if the job is completed, check how long ago
    const completedAt = await this.disputeRepository.getJobCompletedAt(jobId);
    if (completedAt) {
      const windowDaysStr = await this.disputeRepository.getSystemSetting(
        "dispute_window_days",
        "30",
      );
      const windowDays = parseInt(windowDaysStr, 10) || 30;
      const ageDays =
        (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > windowDays) {
        throw new BadRequestException(
          `Disputes can only be filed within ${windowDays} day${windowDays === 1 ? "" : "s"} of job completion. This job was completed ${Math.floor(ageDays)} day${Math.floor(ageDays) === 1 ? "" : "s"} ago.`,
        );
      }
    }

    // Verify the opener is actually a party on this job (customer or provider)
    const { customerId, providerUserId } =
      await this.disputeRepository.getJobParties(jobId);
    if (!customerId && !providerUserId) {
      throw new NotFoundException("Job not found");
    }
    if (openedBy !== customerId && openedBy !== providerUserId) {
      throw new ForbiddenException(
        "Only the customer or provider of this job can file a dispute",
      );
    }

    const dispute = await this.disputeRepository.createDispute(
      jobId,
      openedBy,
      reason,
      description,
      evidenceImages,
    );
    await this.auditLogRepository.createAuditLog(
      openedBy,
      "create_dispute",
      "dispute",
      dispute.id,
      { job_id: jobId, reason },
    );

    // Notify dispute opener — queue if workers enabled, else inline
    const otherPartyId = openedBy === customerId ? providerUserId : customerId;

    if (this.workersEnabled) {
      this.notificationQueue
        .add("notify-dispute-created", {
          disputeId: dispute.id,
          openedBy,
          jobId,
          otherPartyId: otherPartyId ?? null,
        })
        .catch((err: any) => {
          this.logger.warn(
            `Failed to enqueue dispute creation notification: ${err.message}`,
            "DisputeService",
          );
        });
    } else {
      this.userClient
        .getUserEmail(openedBy)
        .then((email) => {
          if (!email) return;
          this.notificationClient.sendEmail({
            to: email,
            template: "MESSAGE_RECEIVED",
            variables: {
              recipientName: email.split("@")[0],
              senderName: "LocalServices Support",
              messagePreview: `A dispute #${dispute.id} has been opened for job #${jobId}. Our team will review it shortly.`,
              replyUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/disputes/${dispute.id}`,
            },
          });
        })
        .catch((err: any) => {
          this.logger.warn(
            `Failed to send dispute creation email: ${err.message}`,
            "DisputeService",
          );
        });
    }

    await this.cacheInvalidation.invalidateEntity("disputes");
    // Notify both the opener and the other job party (provider or customer) so both see the new dispute
    const otherDisputePartyRoom = otherPartyId ? [`user:${otherPartyId}`] : [];
    this.broadcastService.emit("dispute", dispute.id, "created", [`user:${openedBy}`, ...otherDisputePartyRoom, "admin"], { disputeId: dispute.id, jobId }, openedBy);

    return dispute;
  }

  async getUserDisputes(
    userId: string,
    params: { status?: string; page: number; limit: number },
  ): Promise<{ data: Dispute[]; total: number; page: number; limit: number }> {
    this.logger.log(`Fetching disputes for user ${userId}`, "DisputeService");
    const result = await this.disputeRepository.getUserDisputes(userId, params);
    return { ...result, page: params.page, limit: params.limit };
  }

  async getDisputeForUser(id: string, userId: string): Promise<Dispute> {
    const dispute = await this.disputeRepository.getDisputeById(id);
    if (!dispute) throw new NotFoundException("Dispute not found");
    // Allow access to the user who opened the dispute
    if (dispute.opened_by === userId) return dispute;
    // Also allow the other job party (provider or customer)
    const { customerId, providerUserId } = await this.disputeRepository.getJobParties(dispute.job_id);
    if (userId !== customerId && userId !== providerUserId) {
      throw new ForbiddenException("You do not have access to this dispute");
    }
    return dispute;
  }

  async getAllDisputes(
    queryDto: DisputeListQueryDto,
  ): Promise<{ data: Dispute[]; total: number; page: number; limit: number }> {
    validateDateRange(queryDto.createdFrom, queryDto.createdTo, "createdAt");
    const pagination = resolvePagination(queryDto, { page: 1, limit: 50 });

    this.logger.log(
      `Fetching disputes (page: ${pagination.page}, limit: ${pagination.limit}, offset: ${pagination.offset})`,
      "DisputeService",
    );

    const [disputes, total] = await Promise.all([
      this.disputeRepository.findDisputes(queryDto, pagination),
      this.disputeRepository.countDisputes(queryDto),
    ]);

    return {
      data: disputes,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async getDisputeById(id: string): Promise<Dispute> {
    this.logger.log(`Fetching dispute with ID ${id}`, "DisputeService");

    const dispute = await this.disputeRepository.getDisputeById(id);

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    return dispute;
  }

  async getDisputesByStatus(status: string): Promise<Dispute[]> {
    this.logger.log(
      `Fetching disputes with status: ${status}`,
      "DisputeService",
    );

    return this.disputeRepository.getDisputesByStatus(status);
  }

  async getDisputeStats(): Promise<{
    total: number;
    byStatus: {
      open: number;
      investigating: number;
      resolved: number;
      closed: number;
    };
  }> {
    return this.disputeRepository.getDisputeStats();
  }

  async updateDispute(
    id: string,
    adminId: string,
    status: string,
    resolution: string,
  ): Promise<Dispute> {
    this.logger.log(
      `Updating dispute ${id} by admin ${adminId}`,
      "DisputeService",
    );
    const normalizedStatus =
      status === "in_progress" ? "investigating" : status;

    // Check if dispute exists
    const existingDispute = await this.disputeRepository.getDisputeById(id);
    if (!existingDispute) {
      throw new NotFoundException("Dispute not found");
    }

    // Validate status transition
    const allowed = VALID_TRANSITIONS[existingDispute.status];
    if (!allowed || !allowed.includes(normalizedStatus)) {
      throw new BadRequestException(
        `Invalid status transition: '${existingDispute.status}' → '${normalizedStatus}'. Allowed: ${(allowed || []).join(", ") || "none"}`,
      );
    }

    // Require resolution text when resolving or closing
    if (
      (normalizedStatus === "resolved" || normalizedStatus === "closed") &&
      !resolution
    ) {
      throw new BadRequestException(
        "Resolution text is required when resolving or closing a dispute",
      );
    }

    // Update dispute
    const updatedDispute = await this.disputeRepository.updateDispute(
      existingDispute.id,
      normalizedStatus,
      resolution,
      adminId,
    );

    // Log admin action
    await this.adminActionRepository.createAdminAction(
      adminId,
      "resolve_dispute",
      "dispute",
      existingDispute.id,
      `Status: ${normalizedStatus}, Resolution: ${resolution}`,
    );

    // Create audit log
    await this.auditLogRepository.createAuditLog(
      adminId,
      "update_dispute",
      "dispute",
      id,
      {
        status: normalizedStatus,
        resolution,
        previous_status: existingDispute.status,
      },
    );

    // Emit event for cross-service processing (job status sync, refund triggering)
    try {
      await this.kafkaService.emit("dispute-events", {
        event: "dispute_status_changed",
        dispute_id: existingDispute.id,
        job_id: existingDispute.job_id,
        opened_by: existingDispute.opened_by,
        previous_status: existingDispute.status,
        new_status: normalizedStatus,
        resolution,
        admin_id: adminId,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(
        `Failed to emit dispute event for ${id}: ${err.message}`,
        "DisputeService",
      );
    }

    // Notify dispute opener about status change — queue if workers enabled, else inline
    if (this.workersEnabled) {
      this.notificationQueue
        .add("notify-dispute-status-changed", {
          disputeId: existingDispute.id,
          openedBy: existingDispute.opened_by,
          newStatus: normalizedStatus,
          resolution,
          jobId: existingDispute.job_id,
        })
        .catch((err: any) => {
          this.logger.warn(
            `Failed to enqueue dispute status notification: ${err.message}`,
            "DisputeService",
          );
        });
    } else {
      this.userClient
        .getUserEmail(existingDispute.opened_by)
        .then((email) => {
          if (!email) return;
          this.notificationClient.sendEmail({
            to: email,
            template: "MESSAGE_RECEIVED",
            variables: {
              recipientName: email.split("@")[0],
              senderName: "LocalServices Support",
              messagePreview: `Your dispute #${existingDispute.id} status has been updated to: ${normalizedStatus}. ${resolution ? "Resolution: " + resolution : ""}`,
              replyUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/disputes/${existingDispute.id}`,
            },
          });
        })
        .catch((err: any) => {
          this.logger.warn(
            `Failed to send dispute status email: ${err.message}`,
            "DisputeService",
          );
        });
    }

    await this.cacheInvalidation.invalidateEntity("disputes");
    // Get both job parties so both the opener and the respondent see the resolution
    const disputeJobParties = await this.disputeRepository.getJobParties(existingDispute.job_id).catch(() => ({ customerId: null, providerUserId: null }));
    const disputeUpdateRooms: string[] = [`user:${existingDispute.opened_by}`, "admin"];
    if (disputeJobParties.customerId && disputeJobParties.customerId !== existingDispute.opened_by) {
      disputeUpdateRooms.splice(1, 0, `user:${disputeJobParties.customerId}`);
    }
    if (disputeJobParties.providerUserId && disputeJobParties.providerUserId !== existingDispute.opened_by) {
      disputeUpdateRooms.splice(1, 0, `user:${disputeJobParties.providerUserId}`);
    }
    this.broadcastService.emit("dispute", id, "updated", disputeUpdateRooms, { disputeId: id, status: normalizedStatus }, adminId);

    this.logger.log(`Dispute ${id} updated successfully`, "DisputeService");

    return updatedDispute;
  }

  async getDisputeMessages(
    disputeId: string,
    requestingUserId: string,
  ): Promise<DisputeMessage[]> {
    const dispute = await this.disputeRepository.getDisputeById(disputeId);
    if (!dispute) throw new NotFoundException("Dispute not found");
    // Verify caller is a party to the dispute
    const { customerId, providerUserId } = await this.disputeRepository.getJobParties(dispute.job_id);
    const isParty =
      dispute.opened_by === requestingUserId ||
      customerId === requestingUserId ||
      providerUserId === requestingUserId;
    if (!isParty) throw new ForbiddenException("You do not have access to this dispute");

    return this.disputeRepository.getDisputeMessages(disputeId);
  }

  async addDisputeMessage(
    disputeId: string,
    senderId: string,
    message: string,
    images: { id: string; url: string }[],
    isAdmin: boolean,
  ): Promise<DisputeMessage> {
    const dispute = await this.disputeRepository.getDisputeById(disputeId);
    if (!dispute) throw new NotFoundException("Dispute not found");

    if (!isAdmin) {
      // Non-admin: must be a party to the dispute
      const { customerId, providerUserId } = await this.disputeRepository.getJobParties(dispute.job_id);
      const isParty =
        dispute.opened_by === senderId ||
        customerId === senderId ||
        providerUserId === senderId;
      if (!isParty) throw new ForbiddenException("You do not have access to this dispute");
    }

    if (dispute.status === "resolved" || dispute.status === "closed") {
      throw new BadRequestException("Cannot add messages to a resolved or closed dispute");
    }

    const msg = await this.disputeRepository.createDisputeMessage(
      disputeId,
      senderId,
      message,
      images,
      isAdmin,
    );

    // Broadcast to all parties
    const { customerId, providerUserId } = await this.disputeRepository.getJobParties(dispute.job_id).catch(() => ({ customerId: null, providerUserId: null }));
    const rooms: string[] = ["admin"];
    if (dispute.opened_by) rooms.push(`user:${dispute.opened_by}`);
    if (customerId && customerId !== dispute.opened_by) rooms.push(`user:${customerId}`);
    if (providerUserId && providerUserId !== dispute.opened_by) rooms.push(`user:${providerUserId}`);
    this.broadcastService.emit("dispute", disputeId, "message", rooms, { disputeId, messageId: msg.id }, senderId);

    return msg;
  }
}

export { DisputeMessage };
