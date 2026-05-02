import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { FlexibleIdPipe } from "@/common/pipes/flexible-id.pipe";
import { StrictUuidPipe } from "@/common/pipes/strict-uuid.pipe";
import { RequestService } from "../services/request.service";
import { CreateRequestDto } from "../dto/create-request.dto";
import { UpdateRequestDto } from "../dto/update-request.dto";
import { RequestQueryDto } from "../dto/request-query.dto";
import { SearchRequestDto } from "../dto/search-request.dto";
import {
  RequestResponseDto,
  PaginatedRequestResponseDto,
} from "../dto/request-response.dto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import {
  PermissionsGuard as RolesGuard,
  Roles,
  RequirePermissions,
} from "@/common/rbac";
import { OwnershipGuard } from "@/common/guards/ownership.guard";
import { Ownership } from "@/common/decorators/ownership.decorator";
import { ForbiddenException } from "../../../common/exceptions/http.exceptions";
import { FileServiceClient } from "../../../common/file-service.client";
import {
  requestCreateImageUploadOptions,
  requestImageUploadOptions,
} from "../../../common/config/upload.config";
import "multer";

@Controller("requests")
export class RequestController {
  constructor(
    private readonly requestService: RequestService,
    private readonly fileServiceClient: FileServiceClient,
  ) {}

  @RequirePermissions("requests.create")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor("images", 5, requestCreateImageUploadOptions),
  )
  async createRequest(
    @Body() createRequestDto: CreateRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ): Promise<RequestResponseDto> {
    createRequestDto.user_id = req.user.userId;

    // If images were attached via multipart, upload them to the file service
    if (files && files.length > 0) {
      const uploadedFiles = await this.fileServiceClient.uploadMultipleFiles(
        files,
        {
          category: "request-images",
          linkedEntityType: "request",
          visibility: "public",
        },
        req.user.userId,
        req.user.role,
        req.headers["x-tenant-id"] as string | undefined,
      );
      createRequestDto.images = uploadedFiles.map((f: any) => ({
        id: f.id,
        url: f.url,
      }));
    } else {
      // No real files — discard any body-provided images (e.g. [{}, {}] from JSON tests)
      createRequestDto.images = undefined;
    }

    return this.requestService.createRequest(createRequestDto);
  }

  // Admin stats endpoint
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions("requests.view_stats")
  @Get("stats")
  @HttpCode(HttpStatus.OK)
  async getRequestStats() {
    return this.requestService.getRequestStats();
  }

  // Public — anyone can browse open requests
  @UseGuards(JwtAuthGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getRequests(
    @Query() queryDto: RequestQueryDto,
    @Req() req: any,
  ): Promise<PaginatedRequestResponseDto> {
    return this.requestService.getRequests(queryDto, req.user);
  }

  // Public — full-text search across service requests using PostgreSQL tsvector
  @UseGuards(JwtAuthGuard)
  @Get("search")
  @HttpCode(HttpStatus.OK)
  async searchRequests(@Query() query: SearchRequestDto) {
    return this.requestService.searchRequests(query);
  }

  // Authenticated — fetch only the calling user's requests
  @UseGuards(JwtAuthGuard)
  @Get("my")
  @HttpCode(HttpStatus.OK)
  async getMyRequests(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<{
    data: RequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const parsedPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit ?? "20", 10) || 20),
    );
    const result = await this.requestService.getRequestsByUser(
      req.user.userId,
      parsedLimit,
      parsedPage,
    );
    return { ...result, page: parsedPage, limit: parsedLimit };
  }

  // Public — anyone can browse a single request
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async getRequestById(
    @Param("id", FlexibleIdPipe) id: string,
  ): Promise<RequestResponseDto> {
    return this.requestService.getRequestById(id);
  }

  // Authenticated — owner can upload images for their service request
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership({ resourceType: "request", userIdField: "user_id" })
  @Post(":id/images")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor("files", 10, requestImageUploadOptions))
  async uploadRequestImages(
    @Param("id", StrictUuidPipe) requestId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      requestId: string;
      uploadedFiles: any[];
    };
  }> {
    if (!files || files.length === 0) {
      throw new BadRequestException("At least one image file is required");
    }

    // Resource already fetched and validated by OwnershipGuard
    const request = req.resource;

    // Upload files to external file service
    const uploadedFiles = await this.fileServiceClient.uploadMultipleFiles(
      files,
      {
        category: "service-request",
        linkedEntityId: requestId,
        linkedEntityType: "request",
      },
      req.user.userId,
      req.user.role,
      req.headers["x-tenant-id"] as string | undefined,
    );

    return {
      success: true,
      message: `${uploadedFiles.length} image(s) uploaded successfully for service request`,
      data: {
        requestId,
        uploadedFiles,
      },
    };
  }

  // Authenticated — owner can update their own request
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership({ resourceType: "request", userIdField: "user_id" })
  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async updateRequest(
    @Param("id", StrictUuidPipe) id: string,
    @Body() updateRequestDto: UpdateRequestDto,
    @Req() req: any,
  ): Promise<RequestResponseDto> {
    // Resource already validated by OwnershipGuard
    return this.requestService.updateRequest(
      id,
      updateRequestDto,
      req.user.userId,
    );
  }

  // Authenticated — owner can cancel their own open request
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership({ resourceType: "request", userIdField: "user_id" })
  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  async cancelRequest(
    @Param("id", StrictUuidPipe) id: string,
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    await this.requestService.cancelRequest(id, req.user.userId);
    return {
      success: true,
      message: "Service request cancelled successfully",
    };
  }

  // Admin only — hard delete
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions("requests.manage")
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRequest(@Param("id", StrictUuidPipe) id: string): Promise<void> {
    return this.requestService.deleteRequest(id);
  }

  // Authenticated — admin / internal lookup by user id
  @UseGuards(JwtAuthGuard)
  @Get("user/:userId")
  @HttpCode(HttpStatus.OK)
  async getRequestsByUser(
    @Param("userId", FlexibleIdPipe) userId: string,
    @Req() req: any,
  ): Promise<{
    data: RequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (
      !req.user.permissions?.includes("requests.manage") &&
      req.user.userId !== userId
    ) {
      throw new ForbiddenException(
        "You can only view service requests belonging to your own account",
      );
    }
    const result = await this.requestService.getRequestsByUser(userId);
    return { ...result, page: 1, limit: result.data.length || 1 };
  }
}
