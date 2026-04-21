import { apiClient } from "./api-client";

export interface Favorite {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_description: string;
  provider_rating: number;
  created_at: string;
}

class FavoriteService {
  async getFavorites(params?: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }): Promise<{ data: Favorite[]; total: number; page: number; limit: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params?.sort_order) queryParams.append("sort_order", params.sort_order);
    const qs = queryParams.toString();
    const response = await apiClient.get<any>(`/favorites${qs ? `?${qs}` : ""}`);
    const payload = response.data;
    const list = apiClient.extractList<Favorite>(payload);
    return {
      data: list,
      total: payload?.total ?? list.length,
      page: payload?.page ?? params?.page ?? 1,
      limit: payload?.limit ?? params?.limit ?? 20,
    };
  }

  async addFavorite(providerId: string): Promise<Favorite> {
    const response = await apiClient.post<Favorite>("/favorites", {
      provider_id: providerId,
    });
    return response.data;
  }

  async removeFavorite(providerId: string): Promise<void> {
    const response = await apiClient.delete<void>(`/favorites/${providerId}`);
    return response.data;
  }

  async isFavorite(providerId: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites();
      return favorites.some((fav) => fav.provider_id === providerId);
    } catch (error) {
      return false;
    }
  }
}

export const favoriteService = new FavoriteService();
