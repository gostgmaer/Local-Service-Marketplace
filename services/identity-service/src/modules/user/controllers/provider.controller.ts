import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlexibleIdPipe } from "../../../common/pipes/flexible-id.pipe";
import { StrictUuidPipe } from "../../../common/pipes/strict-uuid.pipe";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { ProviderService } from "../services/provider.service";
import { ProviderDocumentService } from "../services/provider-document.service";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";
import { UpdateProviderServicesDto } from "../dto/update-provider-services.dto";
import { UpdateProviderAvailabilityDto } from "../dto/update-provider-availability.dto";
import { AddProviderServiceDto } from "../dto/add-provider-service.dto";
import { UpdateVerificationStatusDto } from "../dto/update-verification.dto";
import { ProviderQueryDto } from "../dto/provider-query.dto";
import { ProviderResponseDto } from "../dto/provider-response.dto";
import { PaginatedResponseDto } from "../dto/paginated-response.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import {
  PermissionsGuard as RolesGuard,
  RequirePermissions,
} from "@/common/rbac";
import { FileServiceClient } from "../../../common/file-service.client";
import { providerProfileUploadOptions } from "../../../common/config/upload.config";
import "multer";

@Controller("providers")
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly providerDocumentService: ProviderDocumentService,
    private readonly fileServiceClient: FileServiceClient,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @RequirePermissions("provider_profile.update")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProvider(
    @Body() createProviderDto: CreateProviderDto,
    @Req() req: any,
  ): Promise<ProviderResponseDto> {
    createProviderDto.user_id = req.user.userId;
    this.logger.info("POST /providers", {
      context: "ProviderController",
      user_id: createProviderDto.user_id,
    });
    return this.providerService.createProvider(createProviderDto);
  }

  @Get("nearby")
  @HttpCode(HttpStatus.OK)
  async getNearbyProviders(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("radius") radius?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      throw new BadRequestException(
        "lat and lng query params are required and must be valid numbers",
      );
    }
    const radiusKm = radius ? parseFloat(radius) : 25;
    const lim = limit ? parseInt(limit, 10) : 20;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.providerService.findNearbyProviders(
      latNum,
      lngNum,
      radiusKm,
      lim,
      off,
    );
  }

  @RequirePermissions("provider_documents.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(":id/documents")
  @HttpCode(HttpStatus.OK)
  async getProviderDocuments(
    @Param("id", StrictUuidPipe) id: string,
    @Req() req: any,
  ): Promise<{ data: any[]; total: number }> {
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException("You can only view your own documents");
    }

    this.logger.info("GET /providers/:id/documents", {
      context: "ProviderController",
      provider_id: id,
    });

    return this.providerDocumentService.getProviderDocuments(id);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async getProvider(
    @Param("id", FlexibleIdPipe) id: string,
  ): Promise<ProviderResponseDto> {
    this.logger.info("GET /providers/:id", {
      context: "ProviderController",
      provider_id: id,
    });
    return this.providerService.getProvider(id);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProviders(
    @Query() queryDto: ProviderQueryDto,
  ): Promise<PaginatedResponseDto<ProviderResponseDto>> {
    this.logger.info("GET /providers", {
      context: "ProviderController",
      query: queryDto,
    });
    return this.providerService.getProviders(queryDto);
  }

  @RequirePermissions("provider_profile.update")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async updateProvider(
    @Param("id", StrictUuidPipe) id: string,
    @Body() updateProviderDto: UpdateProviderDto,
    @Req() req: any,
  ): Promise<ProviderResponseDto> {
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException(
        "You can only manage your own provider profile",
      );
    }
    this.logger.info("PATCH /providers/:id", {
      context: "ProviderController",
      provider_id: id,
    });
    return this.providerService.updateProvider(id, updateProviderDto);
  }

  /**
   * Upload profile picture for provider
   * POST /providers/:id/profile-picture
   */
  @RequirePermissions("provider_profile.update")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(":id/profile-picture")
  @UseInterceptors(FileInterceptor("files", providerProfileUploadOptions))
  @HttpCode(HttpStatus.OK)
  async uploadProviderProfilePicture(
    @Param("id", StrictUuidPipe) id: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Profile picture file is required");
    }
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException(
        "You can only manage your own provider profile",
      );
    }

    this.logger.info("POST /providers/:id/profile-picture", {
      context: "ProviderController",
      provider_id: id,
      filename: file.originalname,
      filesize: file.size,
    });

    const userId = req.user.userId;
    const userRole = req.user.role || "provider";
    const tenantId = req.headers["x-tenant-id"] as string | undefined;

    // Upload file to external file service
    const uploadedFile = await this.fileServiceClient.uploadFile(
      file,
      {
        category: "profile-picture",
        description: "Provider profile picture",
        visibility: "public",
        linkedEntityType: "provider",
        linkedEntityId: id,
        tags: ["provider", "profile", "avatar"],
      },
      userId,
      userRole,
      tenantId,
    );

    // Update provider profile with file URL
    const updatedProvider = await this.providerService.updateProvider(id, {
      profile_picture_url: uploadedFile.url,
    });

    return {
      success: true,
      data: { provider: updatedProvider, file: uploadedFile },
      message: "Provider profile picture uploaded successfully",
    };
  }

  /**
   * Admin: verify or reject a provider
   * PATCH /providers/:id/verify
   */
  @RequirePermissions("providers.verify")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(":id/verify")
  @HttpCode(HttpStatus.OK)
  async verifyProvider(
    @Param("id", StrictUuidPipe) id: string,
    @Body() dto: UpdateVerificationStatusDto,
  ): Promise<ProviderResponseDto> {
    this.logger.info("PATCH /providers/:id/verify", {
      context: "ProviderController",
      provider_id: id,
      status: dto.status,
    });
    return this.providerService.verifyProvider(id, dto.status, dto.reason);
  }

  @RequirePermissions("provider_profile.update")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(
    @Param("id", StrictUuidPipe) id: string,
    @Req() req: any,
  ): Promise<void> {
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException(
        "You can only manage your own provider profile",
      );
    }
    this.logger.info("DELETE /providers/:id", {
      context: "ProviderController",
      provider_id: id,
    });
    return this.providerService.deleteProvider(id);
  }

  /**
   * Update provider service categories
   * PATCH /providers/:id/services
   */
  @RequirePermissions("provider_services.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(":id/services")
  @HttpCode(HttpStatus.OK)
  async updateProviderServices(
    @Param("id", StrictUuidPipe) id: string,
    @Body() dto: UpdateProviderServicesDto,
    @Req() req: any,
  ): Promise<ProviderResponseDto> {
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException(
        "You can only manage your own provider profile",
      );
    }
    this.logger.info("PATCH /providers/:id/services", {
      context: "ProviderController",
      provider_id: id,
      service_count: dto.service_categories.length,
    });

    // Use the existing updateProvider method with only service_categories
    return this.providerService.updateProvider(id, {
      service_categories: dto.service_categories,
    });
  }

  /**
   * Get provider availability schedule
   * GET /providers/:id/availability
   */
  @Get(":id/availability")
  @HttpCode(HttpStatus.OK)
  async getProviderAvailability(
    @Param("id", StrictUuidPipe) id: string,
  ): Promise<any[]> {
    this.logger.info("GET /providers/:id/availability", {
      context: "ProviderController",
      provider_id: id,
    });
    return this.providerService.getProviderAvailability(id);
  }

  /**
   * Update provider availability schedule
   * PATCH /providers/:id/availability
   */
  @RequirePermissions("provider_availability.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(":id/availability")
  @HttpCode(HttpStatus.OK)
  async updateProviderAvailability(
    @Param("id", StrictUuidPipe) id: string,
    @Body() dto: UpdateProviderAvailabilityDto,
    @Req() req: any,
  ): Promise<ProviderResponseDto> {
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException(
        "You can only manage your own provider profile",
      );
    }
    this.logger.info("PATCH /providers/:id/availability", {
      context: "ProviderController",
      provider_id: id,
      slot_count: dto.availability.length,
    });

    // Use the existing updateProvider method with only availability
    return this.providerService.updateProvider(id, {
      availability: dto.availability,
    });
  }
  /**
   * Get isolated provider services
   * GET /providers/:id/services
   */
  @Get(":id/services")
  @HttpCode(HttpStatus.OK)
  async getProviderServices(
    @Param("id", StrictUuidPipe) id: string,
  ): Promise<any[]> {
    this.logger.info("GET /providers/:id/services", {
      context: "ProviderController",
      provider_id: id,
    });
    return this.providerService.getProviderServices(id);
  }

  /**
   * Add a single provider service category
   * POST /providers/:id/services
   */
  @RequirePermissions("provider_services.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(":id/services")
  @HttpCode(HttpStatus.CREATED)
  async addProviderService(
    @Param("id", StrictUuidPipe) id: string,
    @Body() dto: AddProviderServiceDto,
    @Req() req: any,
  ): Promise<any> {
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException(
        "You can only manage your own provider profile",
      );
    }
    this.logger.info("POST /providers/:id/services", {
      context: "ProviderController",
      provider_id: id,
      category_id: dto.category_id,
    });
    return this.providerService.addProviderService(id, dto.category_id);
  }

  /**
   * Remove a single provider service category
   * DELETE /providers/:id/services/:serviceId
   */
  @RequirePermissions("provider_services.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(":id/services/:serviceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProviderService(
    @Param("id", StrictUuidPipe) id: string,
    @Param("serviceId", StrictUuidPipe) serviceId: string,
    @Req() req: any,
  ): Promise<void> {
    if (
      !req.user.permissions?.includes("providers.manage") &&
      req.user.providerId !== id
    ) {
      throw new ForbiddenException(
        "You can only manage your own provider profile",
      );
    }
    this.logger.info("DELETE /providers/:id/services/:serviceId", {
      context: "ProviderController",
      provider_id: id,
      service_id: serviceId,
    });
    return this.providerService.removeProviderService(id, serviceId);
  }
}
