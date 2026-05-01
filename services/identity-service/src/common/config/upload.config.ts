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

const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const documentMimeTypes = new Set([...imageMimeTypes, "application/pdf"]);
const documentExtensions = new Set([...imageExtensions, ".pdf"]);

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

const createUploadOptions = (policy: UploadPolicy): MulterOptions => ({
  storage: memoryStorage(),
  limits: {
    files: policy.maxFiles,
    fileSize: policy.maxFileSizeMb * BYTES_PER_MB,
  },
  fileFilter: buildFileFilter(policy),
});

export const userProfileUploadOptions = createUploadOptions({
  maxFiles: 1,
  maxFileSizeMb: 5,
  allowedMimeTypes: imageMimeTypes,
  allowedExtensions: imageExtensions,
  fileLabel: "profile image",
});

export const providerProfileUploadOptions = createUploadOptions({
  maxFiles: 1,
  maxFileSizeMb: 5,
  allowedMimeTypes: imageMimeTypes,
  allowedExtensions: imageExtensions,
  fileLabel: "profile image",
});

export const providerPortfolioUploadOptions = createUploadOptions({
  maxFiles: 10,
  maxFileSizeMb: 8,
  allowedMimeTypes: imageMimeTypes,
  allowedExtensions: imageExtensions,
  fileLabel: "portfolio image",
});

export const providerDocumentUploadOptions = createUploadOptions({
  maxFiles: 10,
  maxFileSizeMb: 10,
  allowedMimeTypes: documentMimeTypes,
  allowedExtensions: documentExtensions,
  fileLabel: "document",
});