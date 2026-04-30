"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Avatar } from "@/components/ui/Avatar";

import { favoriteService } from "@/services/favorite-service";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { Permission } from "@/utils/permissions";
import { Heart, Star, ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/config/constants";
import { toast } from "react-hot-toast";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export default function FavoritesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const limit = 12;
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder] = useState<"asc" | "desc">("desc");

  useRealtimeList(["favorite:created", "favorite:deleted"], ["favorites"]);

  const {
    data: favoritesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["favorites", user?.id, page, limit, sortBy, sortOrder],
    queryFn: () => favoriteService.getFavorites({ page, limit, sort_by: sortBy, sort_order: sortOrder }),
  });

  const favorites = favoritesData?.data ?? [];
  const totalFavorites = favoritesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFavorites / limit));

  const removeFavoriteMutation = useMutation({
    mutationFn: async (providerId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      await favoriteService.removeFavorite(providerId);
    },
    onSuccess: () => {
      toast.success("Removed from favorites");
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove favorite");
    },
  });

  const handleRemove = (providerId: string) => {
    setPendingProviderId(providerId);
    setConfirmOpen(true);
  };

  const handleConfirmRemove = () => {
    if (pendingProviderId) {
      removeFavoriteMutation.mutate(pendingProviderId);
    }
    setConfirmOpen(false);
    setPendingProviderId(null);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto container-custom py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto container-custom py-8">
          <ErrorState
            title="Failed to load favorites"
            message="We couldn't load your saved providers."
            retry={() => refetch()}
          />
        </div>
      </Layout>
    );
  }

  const hasFavorites = totalFavorites > 0;

  return (
    <>
      <ProtectedRoute requiredPermissions={[Permission.FAVORITES_MANAGE]}>
        <Layout>
          <div className="max-w-6xl mx-auto container-custom py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="h-8 w-8 text-red-500 fill-current" />
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Saved Providers
                </h1>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-gray-600 dark:text-gray-400">
                  {hasFavorites
                    ? `You have ${totalFavorites} saved ${totalFavorites === 1 ? "provider" : "providers"}`
                    : "You haven't saved any providers yet"}
                </p>
                {hasFavorites && (
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="created_at">Sort by Date Added</option>
                    <option value="business_name">Sort by Name</option>
                    <option value="rating">Sort by Rating</option>
                  </select>
                )}
              </div>
            </div>

            {!hasFavorites ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No saved providers yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Start saving your favorite service providers to easily find
                    them later
                  </p>
                  <Link href="/providers">
                    <Button>Browse Providers</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
               <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map((favorite) => (
                  <Card
                    key={favorite.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <Avatar name={favorite.provider_name} size="lg" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => handleRemove(favorite.provider_id)}
                          disabled={removeFavoriteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {favorite.provider_name}
                      </h3>

                      {favorite.provider_rating != null && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {Number(favorite.provider_rating).toFixed(1)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">Rating</span>
                        </div>
                      )}
                    </CardHeader>

                    <CardContent>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {favorite.provider_description ||
                          "No description available"}
                      </p>

                      <div className="flex gap-2">
                        <Link
                          href={`/providers/${favorite.provider_id}`}
                          className="flex-1"
                        >
                          <Button
                            variant="outline"
                            className="w-full"
                            size="sm"
                          >
                            View Profile
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                        <Link href={ROUTES.CREATE_REQUEST} className="flex-1">
                          <Button className="w-full" size="sm">
                            Request Service
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
              </>
            )}
          </div>
        </Layout>
      </ProtectedRoute>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setPendingProviderId(null);
        }}
        onConfirm={handleConfirmRemove}
        title="Remove from Favorites"
        message="Remove this provider from your favorites?"
        confirmLabel="Remove"
        variant="danger"
        isLoading={removeFavoriteMutation.isPending}
      />
    </>
  )
}
