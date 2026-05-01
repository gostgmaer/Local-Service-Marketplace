import { BadRequestException } from "@nestjs/common";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { extname } from "path";
import { memoryStorage } from "multer";

const BYTES_PER_MB = 1024 * 1024;

type UploadPolicy = {
  maxFiles: number;
  maxFileSizeMb: number;
  allowedMimeTypes: ReadonlySet<string>;
  allowedExtensions: ReadonlySet<string>;
  fileLabel: string;
};

type UploadFileFilterCallback = (
  error: Error | null,
  acceptFile: boolean,
) => void;

const attachmentMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "video/mp4",
  "video/quicktime",
]);

const attachmentExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".mp4",
  ".mov",
]);

const buildFileFilter =
  (policy: UploadPolicy) =>
  (
    _req: unknown,
    file: Express.Multer.File,
    callback: UploadFileFilterCallback,
  ) => {
    const mimeType = (file.mimetype || "").toLowerCase();
    const extension = extname(file.originalname || "").toLowerCase();

    if (
      !policy.allowedMimeTypes.has(mimeType) ||
      !policy.allowedExtensions.has(extension)
    ) {
      callback(
        new BadRequestException(
          `Invalid ${policy.fileLabel} type. Allowed types: ${Array.from(policy.allowedExtensions).join(", ")}`,
        ),
        false,
      );
      return;
    }

    callback(null, true);
  };

export const messageAttachmentUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    files: 1,
    fileSize: 25 * BYTES_PER_MB,
  },
  fileFilter: buildFileFilter({
    maxFiles: 1,
    maxFileSizeMb: 25,
    allowedMimeTypes: attachmentMimeTypes,
    allowedExtensions: attachmentExtensions,
    fileLabel: "attachment",
  }),
};