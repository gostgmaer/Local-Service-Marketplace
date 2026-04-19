import { apiClient } from "./api-client";

export interface RequestImage {
  id: string;
  url: string;
}

interface RawUploadedFile {
  id: string;
  url: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

/**
 * Uploads image files for a service request to the file-upload-service.
 * Files are stored as public so the URL can be rendered directly without an
 * additional API call.
 *
 * @param files  Files selected by the user (max 5, images only)
 * @returns      Array of { id, url } — id is used for later deletion
 */
export async function uploadRequestImages(
  files: File[],
): Promise<RequestImage[]> {
  if (files.length === 0) return [];

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("category", "request-images");
  formData.append("isPublic", "true");

  // apiClient response interceptor unwraps { success, data } → data (the array)
  const response = await apiClient.post<any>("/files/upload", formData);

  const raw: RawUploadedFile[] = apiClient.extractList<RawUploadedFile>(
    response.data,
  );

  return raw.map((f) => ({ id: f.id, url: f.url }));
}
