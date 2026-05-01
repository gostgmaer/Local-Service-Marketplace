import { BadRequestException } from "@nestjs/common";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { extname } from "path";
import { memoryStorage } from "multer";

const BYTES_PER_MB = 1024 * 1024;

type UploadFileFilterCallback = (
  error: Error | null,
  acceptFile: boolean,
) => void;

const receiptMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const receiptExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

export const paymentReceiptUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    files: 1,
    fileSize: 10 * BYTES_PER_MB,
  },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: UploadFileFilterCallback,
  ) => {
    const mimeType = (file.mimetype || "").toLowerCase();
    const extension = extname(file.originalname || "").toLowerCase();

    if (!receiptMimeTypes.has(mimeType) || !receiptExtensions.has(extension)) {
      callback(
        new BadRequestException(
          `Invalid receipt file type. Allowed types: ${Array.from(receiptExtensions).join(", ")}`,
        ),
        false,
      );
      return;
    }

    callback(null, true);
  },
};
