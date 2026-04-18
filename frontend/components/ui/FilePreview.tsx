"use client";

import { useState, useEffect } from "react";
import { FileText, ExternalLink, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api-client";

export interface FilePreviewProps {
  /**
   * PRIVATE documents (government IDs, certifications, etc.).
   * Always resolved via an authenticated API call to GET /api/v1/files/:fileId
   * through the gateway so that JWT is validated before the URL is returned.
   * Use this for any user-uploaded sensitive document.
   */
  fileId?: string | null;
  /**
   * PUBLIC files only (e.g. CDN images, non-sensitive assets).
   * Rendered directly — no auth check. Never use this for private documents.
   */
  src?: string | null;
  /** Used for alt/title text and PDF detection (.pdf extension). */
  fileName?: string | null;
  /** Tailwind class(es) for the outer container. */
  className?: string;
  /** Maximum height for the preview area, e.g. "50vh" or "600px". */
  maxHeight?: string;
}

/**
 * Secure document preview component.
 *
 * - `fileId` mode (PRIVATE): calls GET /api/v1/files/:fileId through the
 *   authenticated gateway before displaying anything. The gateway validates
 *   the JWT, so unauthenticated callers can never access the file.
 * - `src` mode (PUBLIC): renders the URL directly — only for non-sensitive files.
 *
 * Images are rendered as <img>; PDFs are rendered as <iframe>.
 */
export function FilePreview({
  fileId,
  src,
  fileName,
  className = "",
  maxHeight = "50vh",
}: FilePreviewProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdf = fileName?.toLowerCase().endsWith(".pdf") ?? false;

  useEffect(() => {
    setResolvedUrl(null);
    setError(null);

    // PUBLIC mode — use src directly, no API call needed
    if (!fileId) {
      setResolvedUrl(src ?? null);
      return;
    }

    // PRIVATE mode — always call the authenticated gateway endpoint
    setLoading(true);
    apiClient
      .get<{ url: string; mimeType?: string }>(`/files/${fileId}`)
      .then((res) => {
        // apiClient interceptor already unwraps the standardized envelope,
        // so res.data is the inner data object: { url, mimeType, ... }
        const url = res.data?.url;
        if (!url) throw new Error("File URL not found in response");
        setResolvedUrl(url);
      })
      .catch(() => setError("Failed to load document. You may not have permission to view it."))
      .finally(() => setLoading(false));
  }, [fileId, src]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 text-gray-400 min-h-[160px] ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading document...</p>
      </div>
    );
  }

  if (error || !resolvedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 text-gray-400 min-h-[160px] ${className}`}>
        <FileText className="h-12 w-12" />
        <p className="text-sm text-center">
          {error ?? "No document available"}
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {isPdf ? (
        <iframe
          src={resolvedUrl}
          style={{ height: maxHeight }}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white"
          title={fileName ?? "Document Preview"}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedUrl}
          alt={fileName ?? "Document"}
          style={{ maxHeight }}
          className="max-w-full mx-auto rounded shadow object-contain block"
        />
      )}

      <div className="mt-2 flex justify-center">
        <a
          href={resolvedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </a>
      </div>
    </div>
  );
}
