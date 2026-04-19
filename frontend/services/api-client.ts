import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import { getSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3700";

// Deduplicate concurrent getSession() calls: all requests that fire at the same
// time share a single in-flight session fetch instead of triggering N refreshes.
let _sessionPromise: Promise<Awaited<ReturnType<typeof getSession>>> | null =
  null;

function getSessionOnce() {
  if (!_sessionPromise) {
    _sessionPromise = getSession().finally(() => {
      _sessionPromise = null;
    });
  }
  return _sessionPromise;
}

// Force a backend token refresh regardless of whether NextAuth considers the
// current access token valid. Calls the custom /api/auth/force-refresh route
// which reads the raw session cookie, hits the identity-service refresh endpoint
// directly, and writes a fresh session cookie back. Returns the new access token,
// or null if the refresh token is also expired/invalid (→ user must log in again).
let _forceRefreshPromise: Promise<string | null> | null = null;
function forceRefreshToken(): Promise<string | null> {
  if (!_forceRefreshPromise) {
    _forceRefreshPromise = fetch("/api/auth/force-refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) return null;
        return r.json().then((body) => body?.accessToken ?? null);
      })
      .catch(() => null)
      .finally(() => {
        _forceRefreshPromise = null;
      });
  }
  return _forceRefreshPromise;
}

// Standardized API Response interface
interface StandardResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  error?: { code: string; message: string; details?: any };
}

// Legacy API Error Response interface (for backward compatibility)
interface ApiErrorResponse {
  success?: boolean;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string | string[]; // NestJS validation errors
  statusCode?: number;
  timestamp?: string;
  path?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 72000,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true, // Include HTTP-only cookies
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add Authorization header from NextAuth session
    this.client.interceptors.request.use(
      async (config) => {
        // When sending FormData, remove the default application/json Content-Type so
        // axios can auto-set multipart/form-data with the correct boundary.
        if (config.data instanceof FormData) {
          delete config.headers["Content-Type"];
        }

        // Get the current session (deduplicating concurrent calls)
        const session = await getSessionOnce();
        if (session?.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${session.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor - unwrap standardized response and handle errors
    this.client.interceptors.response.use(
      (response) => {
        // Check if response follows the standardized format
        if (
          response.data &&
          typeof response.data === "object" &&
          "success" in response.data
        ) {
          const standardResponse = response.data as StandardResponse;

          // For successful responses, unwrap the data field
          if (standardResponse.success) {
            // If there's pagination metadata, preserve it alongside data
            if (standardResponse.meta != null) {
              // For paginated responses, return object with data and meta fields
              response.data = {
                data: standardResponse.data,
                total: standardResponse.meta.total,
                page: standardResponse.meta.page,
                limit: standardResponse.meta.limit,
                totalPages: standardResponse.meta.totalPages,
              };
            } else {
              // For non-paginated responses, just return the data
              response.data = standardResponse.data;
            }
          } else {
            // Error response in standardized format
            return Promise.reject({
              response: {
                status: standardResponse.statusCode,
                data: standardResponse,
              },
            });
          }
        }
        return response;
      },
      async (error: AxiosError<ApiErrorResponse>) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retried?: boolean };

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retried) {
          originalRequest._retried = true;

          // Force NextAuth to re-evaluate the JWT callback and issue a fresh
          // access token from the refresh token. This closes the gap where the
          // backend has already rejected the old token but the UI still holds
          // the old NextAuth session.
          const freshToken = await forceRefreshToken();

          if (!freshToken) {
            // Refresh also failed — genuinely expired. Sign out.
            await signOut({ redirect: false });
            window.location.href = "/login";
            return Promise.reject(error);
          }

          // Retry the original request with the new access token
          if (originalRequest.headers) {
            (originalRequest.headers as any).Authorization = `Bearer ${freshToken}`;
          }
          return this.client(originalRequest);
        }

        this.handleError(error);
        return Promise.reject(error);
      },
    );
  }

  private handleError(error: AxiosError<ApiErrorResponse>) {
    // Handle network errors
    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      return;
    }

    const { status, data } = error.response;

    // Extract error message from standardized or legacy format
    let errorMessage = "An error occurred";

    if (data?.error?.message) {
      errorMessage = data.error.message;
    } else if (Array.isArray(data?.message)) {
      errorMessage = data.message.join(", ");
    } else if (typeof data?.message === "string") {
      errorMessage = data.message;
    }

    // Handle specific status codes
    switch (status) {
      case 400:
        toast.error(`Validation Error: ${errorMessage}`);
        break;
      case 401:
        // Only show session-expired message if the session is genuinely broken.
        // Permission-denied 401s (e.g. wrong role) are handled at the component level.
        toast.error("Authentication required. Please log in.");
        break;
      case 403:
        toast.error("Access Denied");
        break;
      case 404:
        toast.error("Resource not found");
        break;
      case 409:
        toast.error(errorMessage);
        break;
      case 422:
        toast.error(`Validation Error: ${errorMessage}`);
        break;
      case 429:
        toast.error("Too many requests. Please try again later.");
        break;
      case 500:
        toast.error("Internal Server Error. Please try again.");
        break;
      default:
        toast.error(errorMessage);
    }
  }

  /**
   * Safely extract a list/array from various response shapes (raw array vs paginated object)
   */
  static extractList<T>(payload: any): T[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload as T[];
    if (payload && Array.isArray(payload.data)) return payload.data as T[];
    return [];
  }

  extractList<T>(payload: any): T[] {
    return ApiClient.extractList<T>(payload);
  }

  // Public HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
