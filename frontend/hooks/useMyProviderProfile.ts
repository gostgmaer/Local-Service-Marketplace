import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getProviderProfileByUserId } from "@/services/user-service";

/**
 * Canonical hook for the currently-logged-in provider's own profile.
 *
 * Use this everywhere instead of calling getProviderProfileByUserId() with a
 * local queryKey — a single shared key ensures:
 *   - Cache is shared across all pages that need the profile
 *   - Any mutation that invalidates ["my-provider-profile"] is reflected
 *     everywhere instantly
 */
export const MY_PROVIDER_PROFILE_KEY = "my-provider-profile";

export function useMyProviderProfile() {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [MY_PROVIDER_PROFILE_KEY, user?.id],
    queryFn: () => getProviderProfileByUserId(user!.id),
    enabled: isAuthenticated && !!user?.id,
  });
}
