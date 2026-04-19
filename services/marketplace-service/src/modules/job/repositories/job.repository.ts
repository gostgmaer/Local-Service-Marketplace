import { Injectable, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { Job } from "../entities/job.entity";
import { CreateJobDto } from "../dto/create-job.dto";
import { JobStatus } from "../dto/update-job-status.dto";
import { JobQueryDto, JobSortBy, SortOrder } from "../dto/job-query.dto";
import { resolveId } from "@/common/utils/resolve-id.util";
import { ConflictException } from "../../../common/exceptions/http.exceptions";

@Injectable()
export class JobRepository {
  constructor(@Inject("DATABASE_POOL") private readonly pool: Pool) {}

  // ─── Shared query helpers ────────────────────────────────────────────────

  /** SELECT + JOIN fragment shared by all single-row and list queries. */
  private readonly ENRICHED_SELECT = `
    SELECT
      j.*,
      cu.name            AS customer_name,
      cu.email           AS customer_email,
      cu.phone           AS customer_phone,
      pu.name            AS provider_name,
      pu.email           AS provider_email,
      pr.business_name   AS provider_business_name,
      pr.rating          AS provider_rating,
      pr.verification_status AS provider_verification_status,
      sr.description     AS request_description,
      sr.budget          AS request_budget,
      sr.status          AS request_status,
      sr.urgency         AS request_urgency,
      sr.preferred_date  AS request_preferred_date,
      sc.name            AS request_category_name,
      sc.icon            AS request_category_icon,
      prop.price         AS proposal_price,
      prop.message       AS proposal_message,
      prop.estimated_hours AS proposal_estimated_hours,
      prop.start_date    AS proposal_start_date,
      prop.completion_date AS proposal_completion_date
    FROM jobs j
    LEFT JOIN users cu         ON j.customer_id = cu.id
    LEFT JOIN providers pr     ON j.provider_id = pr.id
    LEFT JOIN users pu         ON pr.user_id = pu.id
    LEFT JOIN service_requests sr ON j.request_id = sr.id
    LEFT JOIN service_categories sc ON sr.category_id = sc.id
    LEFT JOIN proposals prop   ON j.proposal_id = prop.id
  `;

  /** Normalise a raw DB row into a typed Job object. */
  private mapRow(row: any): Job {
    return {
      ...row,
      provider_rating:
        row.provider_rating ? parseFloat(row.provider_rating) : null,
    };
  }

  // ────────────────────────────────────────────────────────────────────────

  async getSystemSetting(key: string, defaultValue: string): Promise<string> {
    try {
      const res = await this.pool.query(
        "SELECT value FROM system_settings WHERE key = $1",
        [key],
      );
      return res.rows[0]?.value ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async createJob(dto: CreateJobDto): Promise<Job> {
    const [requestId, providerId, proposalId] = await Promise.all([
      resolveId(this.pool, "service_requests", dto.request_id),
      resolveId(this.pool, "providers", dto.provider_id),
      dto.proposal_id
        ? resolveId(this.pool, "proposals", dto.proposal_id)
        : Promise.resolve(null),
    ]);

    // Atomic check-then-insert: the FOR UPDATE lock serialises concurrent createJob
    // calls for the same request, eliminating the race between existence check and insert.
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT id FROM jobs WHERE request_id = $1 AND status != 'cancelled' LIMIT 1 FOR UPDATE`,
        [requestId],
      );
      if (existing.rows.length > 0) {
        throw new ConflictException("A job already exists for this request");
      }
      // Fetch proposal price so actual_amount is always populated
      let proposalPrice: number | null = null;
      if (proposalId) {
        const priceRes = await client.query(
          `SELECT price FROM proposals WHERE id = $1`,
          [proposalId],
        );
        proposalPrice = priceRes.rows[0]?.price ?? null;
      }

      const result = await client.query(
        `INSERT INTO jobs (
           request_id, provider_id, customer_id, proposal_id, actual_amount, status, started_at
         )
         VALUES ($1, $2, $3, $4, $5, 'scheduled', NOW())
         RETURNING *`,
        [requestId, providerId, dto.customer_id, proposalId, proposalPrice],
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getJobById(id: string): Promise<Job | null> {
    id = await resolveId(this.pool, "jobs", id);
    const result = await this.pool.query(
      `${this.ENRICHED_SELECT} WHERE j.id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    return this.mapRow(result.rows[0]);
  }

  async updateJobStatus(id: string, status: JobStatus): Promise<Job | null> {
    const query = `
      UPDATE jobs
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [status, id]);
    return result.rows[0] || null;
  }

  async completeJob(id: string): Promise<Job | null> {
    const query = `
      UPDATE jobs
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getJobByRequestId(requestId: string): Promise<Job | null> {
    requestId = await resolveId(this.pool, "service_requests", requestId);
    const query = `
      SELECT id, display_id, request_id, provider_id, status, started_at, completed_at
      FROM jobs
      WHERE request_id = $1
    `;

    const result = await this.pool.query(query, [requestId]);
    return result.rows[0] || null;
  }

  async getJobsPaginated(queryDto: JobQueryDto): Promise<Job[]> {
    let {
      provider_id,
      customer_id,
      request_id,
      status,
      started_from,
      started_to,
      completed_from,
      completed_to,
      limit = 20,
      page,
      cursor,
      sortBy = JobSortBy.STARTED_AT,
      sortOrder = SortOrder.DESC,
    } = queryDto;

    [provider_id, customer_id, request_id] = await Promise.all([
      provider_id
        ? resolveId(this.pool, "providers", provider_id)
        : Promise.resolve(undefined),
      customer_id
        ? resolveId(this.pool, "users", customer_id)
        : Promise.resolve(undefined),
      request_id
        ? resolveId(this.pool, "service_requests", request_id)
        : Promise.resolve(undefined),
    ]);

    let query = `
      SELECT j.*,
        pu.name AS provider_name,
        cu.name AS customer_name
      FROM jobs j
      LEFT JOIN providers p ON j.provider_id = p.id
      LEFT JOIN users pu ON p.user_id = pu.id
      LEFT JOIN users cu ON j.customer_id = cu.id
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;
    const usingOffset = page !== undefined && page > 0;

    if (provider_id) {
      query += ` AND j.provider_id = $${paramIndex++}`;
      values.push(provider_id);
    }

    if (customer_id) {
      query += ` AND j.customer_id = $${paramIndex++}`;
      values.push(customer_id);
    }

    if (request_id) {
      query += ` AND j.request_id = $${paramIndex++}`;
      values.push(request_id);
    }

    if (status) {
      query += ` AND j.status = $${paramIndex++}`;
      values.push(status);
    }

    if (started_from) {
      query += ` AND j.started_at >= $${paramIndex++}`;
      values.push(started_from);
    }

    if (started_to) {
      query += ` AND j.started_at <= $${paramIndex++}`;
      values.push(started_to);
    }

    if (completed_from) {
      query += ` AND j.completed_at >= $${paramIndex++}`;
      values.push(completed_from);
    }

    if (completed_to) {
      query += ` AND j.completed_at <= $${paramIndex++}`;
      values.push(completed_to);
    }

    if (cursor && !usingOffset) {
      query += ` AND j.started_at < (SELECT started_at FROM jobs WHERE id = $${paramIndex++})`;
      values.push(cursor);
    }

    const sortMap: Record<JobSortBy, string> = {
      [JobSortBy.STARTED_AT]: "j.started_at",
      [JobSortBy.COMPLETED_AT]: "j.completed_at",
      [JobSortBy.CREATED_AT]: "j.created_at",
    };
    const safeSortColumn = sortMap[sortBy] || "j.started_at";
    const safeSortOrder = sortOrder === SortOrder.ASC ? "ASC" : "DESC";

    query += ` ORDER BY ${safeSortColumn} ${safeSortOrder}, j.id DESC`;

    if (usingOffset) {
      const offset = ((page || 1) - 1) * limit;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      values.push(limit, offset);
    } else {
      query += ` LIMIT $${paramIndex++}`;
      values.push(limit + 1);
    }

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => ({
      ...row,
      provider_name: row.provider_name ?? null,
      customer_name: row.customer_name ?? null,
    }));
  }

  async getJobStats(): Promise<{
    total: number;
    byStatus: {
      scheduled: number;
      in_progress: number;
      completed: number;
      cancelled: number;
      disputed: number;
    };
  }> {
    const query = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'disputed')::int AS disputed
      FROM jobs
    `;
    const result = await this.pool.query(query);
    const row = result.rows[0];
    return {
      total: row.total,
      byStatus: {
        scheduled: row.scheduled,
        in_progress: row.in_progress,
        completed: row.completed,
        cancelled: row.cancelled,
        disputed: row.disputed,
      },
    };
  }

  async countJobs(queryDto: JobQueryDto): Promise<number> {
    let {
      provider_id,
      customer_id,
      request_id,
      status,
      started_from,
      started_to,
      completed_from,
      completed_to,
    } = queryDto;

    [provider_id, customer_id, request_id] = await Promise.all([
      provider_id
        ? resolveId(this.pool, "providers", provider_id)
        : Promise.resolve(undefined),
      customer_id
        ? resolveId(this.pool, "users", customer_id)
        : Promise.resolve(undefined),
      request_id
        ? resolveId(this.pool, "service_requests", request_id)
        : Promise.resolve(undefined),
    ]);

    let query = `SELECT COUNT(*)::int AS total FROM jobs WHERE 1=1`;
    const values: any[] = [];
    let paramIndex = 1;

    if (provider_id) {
      query += ` AND provider_id = $${paramIndex++}`;
      values.push(provider_id);
    }

    if (customer_id) {
      query += ` AND customer_id = $${paramIndex++}`;
      values.push(customer_id);
    }

    if (request_id) {
      query += ` AND request_id = $${paramIndex++}`;
      values.push(request_id);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (started_from) {
      query += ` AND started_at >= $${paramIndex++}`;
      values.push(started_from);
    }

    if (started_to) {
      query += ` AND started_at <= $${paramIndex++}`;
      values.push(started_to);
    }

    if (completed_from) {
      query += ` AND completed_at >= $${paramIndex++}`;
      values.push(completed_from);
    }

    if (completed_to) {
      query += ` AND completed_at <= $${paramIndex++}`;
      values.push(completed_to);
    }
    // Note: countJobs only counts — no JOIN needed for names

    const result = await this.pool.query(query, values);
    return result.rows[0].total;
  }

  async getJobsByProvider(providerId: string): Promise<Job[]> {
    const result = await this.pool.query(
      `${this.ENRICHED_SELECT} WHERE j.provider_id = $1 ORDER BY j.started_at DESC`,
      [providerId],
    );
    return result.rows.map(this.mapRow.bind(this));
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    const result = await this.pool.query(
      `${this.ENRICHED_SELECT} WHERE j.status = $1 ORDER BY j.started_at DESC`,
      [status],
    );
    return result.rows.map(this.mapRow.bind(this));
  }

  async getJobsByCustomer(userId: string): Promise<Job[]> {
    const result = await this.pool.query(
      `${this.ENRICHED_SELECT} WHERE j.customer_id = $1 ORDER BY j.started_at DESC`,
      [userId],
    );
    return result.rows.map(this.mapRow.bind(this));
  }

  async getJobsByProviderUser(userId: string): Promise<Job[]> {
    const result = await this.pool.query(
      `${this.ENRICHED_SELECT} WHERE pr.user_id = $1 ORDER BY j.started_at DESC`,
      [userId],
    );
    return result.rows.map(this.mapRow.bind(this));
  }

  // ✅ NEW METHOD: Cancel job with reason
  async cancelJob(
    jobId: string,
    cancelledBy: string,
    reason: string,
  ): Promise<Job | null> {
    const query = `
      UPDATE jobs 
      SET status = 'cancelled',
          cancelled_by = $1,
          cancellation_reason = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await this.pool.query(query, [cancelledBy, reason, jobId]);
    return result.rows[0] || null;
  }

  // ✅ NEW: Advanced query methods
  async getCancellationStats(startDate?: Date, endDate?: Date): Promise<any[]> {
    const query = `
      SELECT 
        cancelled_by,
        COUNT(*) as count,
        ARRAY_AGG(DISTINCT cancellation_reason) as reasons
      FROM jobs
      WHERE status = 'cancelled'
        AND created_at BETWEEN COALESCE($1, '2020-01-01') AND COALESCE($2, NOW())
      GROUP BY cancelled_by
    `;
    const result = await this.pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getJobsByCancellationType(
    cancelledBy: string,
    limit: number = 20,
  ): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs
      WHERE status = 'cancelled'
        AND cancelled_by = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `;
    const result = await this.pool.query(query, [cancelledBy, limit]);
    return result.rows;
  }

  async getJobsWithActualAmount(
    minAmount: number,
    maxAmount: number,
    limit: number = 20,
  ): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs
      WHERE actual_amount BETWEEN $1 AND $2
        AND actual_amount IS NOT NULL
      ORDER BY actual_amount DESC
      LIMIT $3
    `;
    const result = await this.pool.query(query, [minAmount, maxAmount, limit]);
    return result.rows;
  }

  async getAverageJobDuration(): Promise<any> {
    const query = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/3600) as avg_hours,
        COUNT(*) as completed_count
      FROM jobs
      WHERE status = 'completed'
        AND completed_at IS NOT NULL
        AND started_at IS NOT NULL
    `;
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  async updateActualAmount(jobId: string, amount: number): Promise<Job | null> {
    const query = `
      UPDATE jobs 
      SET actual_amount = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.pool.query(query, [amount, jobId]);
    return result.rows[0] || null;
  }

  /**
   * Update the parent service_request status when job lifecycle changes.
   * Used to revert to 'open' on cancellation and set 'completed' on job completion.
   */
  async updateRequestStatus(
    requestId: string,
    status: "open" | "assigned" | "completed" | "cancelled",
  ): Promise<void> {
    await this.pool.query(
      `UPDATE service_requests SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, requestId],
    );
  }

  /**
   * Returns the completed payment for a given job, if one exists.
   * Used to guard job completion behind payment verification.
   */
  async getCompletedPaymentForJob(
    jobId: string,
  ): Promise<{ id: string; status: string } | null> {
    const result = await this.pool.query(
      `SELECT id, status FROM payments WHERE job_id = $1 AND status = 'completed' LIMIT 1`,
      [jobId],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Auto-complete in_progress jobs that have not been updated within the
   * given cutoff date. Returns the number of rows affected.
   */
  async autoCompleteStaleJobs(cutoffDate: Date): Promise<number> {
    const result = await this.pool.query(
      `UPDATE jobs
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE status = 'in_progress'
         AND updated_at < $1`,
      [cutoffDate],
    );
    return result.rowCount ?? 0;
  }
}
