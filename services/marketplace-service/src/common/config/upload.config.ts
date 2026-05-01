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

const createImageUploadOptions = (
  maxFiles: number,
  fileLabel: string,
  maxFileSizeMb: number = 8,
): MulterOptions => ({
  storage: memoryStorage(),
  limits: {
    files: maxFiles,
    fileSize: maxFileSizeMb * BYTES_PER_MB,
  },
  fileFilter: buildFileFilter({
    maxFiles,
    maxFileSizeMb,
    allowedMimeTypes: imageMimeTypes,
    allowedExtensions: imageExtensions,
    fileLabel,
  }),
});

export const requestCreateImageUploadOptions = createImageUploadOptions(
  5,
  "request image",
);

export const requestImageUploadOptions = createImageUploadOptions(
  10,
  "request image",
);

export const jobPhotoUploadOptions = createImageUploadOptions(
  10,
  "job photo",
);