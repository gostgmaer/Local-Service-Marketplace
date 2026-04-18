import { apiClient } from "@/services/api-client";

/**
 * Resolve a file reference to a direct HTTP URL.
 *
 * - If the value is already an `http(s)://` URL (Azure Blob), return it as-is.
 * - Otherwise treat it as a MongoDB ObjectID and call the file service via the
 *   API gateway (`GET /api/v1/files/:id`) to retrieve the metadata and extract
 *   the `data.url` field.
 */
export async function resolveFileUrl(fileIdOrUrl: string): Promise<string> {
  if (!fileIdOrUrl) throw new Error("No file reference provided");
  if (fileIdOrUrl.startsWith("http")) return fileIdOrUrl;

  const res = await apiClient.get<{ url: string }>(`/files/${fileIdOrUrl}`);

  // apiClient interceptor already unwraps the standardized envelope,
  // so res.data is the inner data object: { url, mimeType, ... }
  const url = res.data?.url;
  if (!url) throw new Error("File URL not found in response");
  return url;
}
