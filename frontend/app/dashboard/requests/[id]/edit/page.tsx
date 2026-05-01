"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/config/constants";
import { Permission } from "@/utils/permissions";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Loading } from "@/components/ui/Loading";
import { ErrorState } from "@/components/ui/ErrorState";
import { requestService, UpdateRequestData } from "@/services/request-service";
import { useRealtimeDetail } from "@/hooks/useRealtimeDetail";
import { ArrowLeft, Lock, Save } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatCurrency } from "@/utils/helpers";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";

export default function EditRequestPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const requestId = params.id as string;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, authLoading, router]);

  const {
    data: request,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => requestService.getRequestById(requestId),
    enabled: isAuthenticated && !!requestId,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => requestService.getCategories(),
    enabled: isAuthenticated,
  });

  const categoryOptions = (categoriesData ?? []).map((cat: any) => ({
    value: cat.id,
    label: cat.name,
  }));

  // If the request is accepted or cancelled while this edit page is open, the lock
  // banner appears automatically — no page refresh needed.
  useRealtimeDetail(["request:updated", "request:deleted", "proposal:accepted"], ["request", requestId], requestId);

  const isOwner = !!user?.id && user.id === request?.user_id;
  const isEditable = isOwner && request?.status === "open";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateRequestData>({
    values: {
      category_id: request?.category_id ?? "",
      description: request?.description ?? "",
      budget: request?.budget ?? 0,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRequestData) => {
      if (!request?.id) throw new Error("Request UUID is not available");
      return requestService.updateRequest(request.id, data);
    },
    onSuccess: () => {
      toast.success("Request updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      router.push(ROUTES.DASHBOARD_REQUEST_DETAIL(request!.id));
    },
    onError: () => toast.error("Couldn't update the request — please check your input and try again."),
  });

  if (authLoading || isLoading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (!isAuthenticated) return null;

  if (error || !request) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <ErrorState
            title="Request not found"
            message="We couldn't find this request."
            retry={() => refetch()}
          />
        </div>
      </Layout>
    );
  }

  const categoryName =
    (request as any).category?.name ??
    categoryOptions.find((c) => c.value === request.category_id)?.label ??
    request.category_id;

  const urgencyLabels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };

  return (
    <ProtectedRoute requiredPermissions={[Permission.REQUESTS_UPDATE]}>
      <Layout>
        <div className="container-custom py-8">
          <div className=" mx-auto">
            <Link
              href={ROUTES.DASHBOARD_REQUEST_DETAIL(requestId)}
              className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Request
            </Link>

            {/* Locked banner */}
            {!isEditable && request && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                <Lock className="h-4 w-4 flex-shrink-0" />
                <span>
                  {!isOwner
                    ? "You do not have permission to edit this request."
                    : `This request is ${request.status} and can no longer be edited.`}
                </span>
              </div>
            )}

            <Card>
              <CardHeader>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isEditable ? "Edit Request" : "Request Details"}
                </h1>
              </CardHeader>
              <CardContent>
                {isEditable ? (
                  <form
                    onSubmit={handleSubmit((data) =>
                      updateMutation.mutate(data),
                    )}
                    className="space-y-6"
                  >
                    <div>
                      <Select
                        label="Category"
                        {...register("category_id")}
                        options={categoryOptions}
                      />
                      {errors.category_id && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.category_id.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                        {...register("description", {
                          required: "Description is required",
                          minLength: {
                            value: 10,
                            message: "At least 10 characters",
                          },
                        })}
                      />
                      {errors.description && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.description.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Budget (₹)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        {...register("budget", {
                          required: "Budget is required",
                          min: {
                            value: 1,
                            message: "Budget must be at least ₹1",
                          },
                          valueAsNumber: true,
                        })}
                      />
                      {errors.budget && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.budget.message}
                        </p>
                      )}
                    </div>

                    {/* Read-only info fields */}
                    {request.urgency && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Urgency
                        </p>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                          {urgencyLabels[request.urgency] ?? request.urgency}
                        </p>
                      </div>
                    )}

                    {request.location?.address && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Service Location
                        </p>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {request.location.address}
                        </p>
                        {(request.location.city || request.location.state) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[
                              request.location.city,
                              request.location.state,
                              request.location.zip_code ||
                                request.location.pincode,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        isLoading={updateMutation.isPending}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            ROUTES.DASHBOARD_REQUEST_DETAIL(requestId),
                          )
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* Read-only view when request is claimed / not owner */
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {categoryName}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Description
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                        {request.description}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Budget
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {formatCurrency(request.budget)}
                      </p>
                    </div>

                    {request.urgency && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Urgency
                        </p>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                          {urgencyLabels[request.urgency] ?? request.urgency}
                        </p>
                      </div>
                    )}

                    {request.location?.address && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Service Location
                        </p>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {request.location.address}
                        </p>
                        {(request.location.city || request.location.state) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[
                              request.location.city,
                              request.location.state,
                              request.location.zip_code ||
                                request.location.pincode,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            ROUTES.DASHBOARD_REQUEST_DETAIL(requestId),
                          )
                        }
                      >
                        Back to Request
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
