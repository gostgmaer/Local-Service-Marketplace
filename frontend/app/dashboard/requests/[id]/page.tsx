"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ROUTES } from "@/config/constants";
import { Permission } from "@/utils/permissions";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { StatusBadge } from "@/components/ui/Badge";
import dynamic from "next/dynamic";
const LocationMap = dynamic(() => import("@/components/ui/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
  ),
});
import { requestService } from "@/services/request-service";
import { proposalService } from "@/services/proposal-service";
import {
  formatDate,
  formatCurrency,
  formatRelativeTime,
} from "@/utils/helpers";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";
import { ArrowLeft, Edit, MapPin, XCircle } from "lucide-react";

import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { can } = usePermissions();
  const isProvider = can(Permission.PROVIDER_PROFILE_VIEW);
  const requestId = params.id as string;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, authLoading, router]);

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => requestService.getRequestById(requestId),
    enabled: isAuthenticated,
  });

  const { data: proposals } = useQuery({
    queryKey: ["proposals", requestId],
    queryFn: () => proposalService.getProposalsByRequest(requestId),
    // Owners see all proposals; providers see only their own (backend filters).
    // Skip entirely if neither owner nor provider with proposals.read.
    enabled: !!requestId && isAuthenticated,
  });

  const acceptProposalMutation = useMutation({
    mutationFn: (proposalId: string) =>
      proposalService.acceptProposal(proposalId),
    onSuccess: () => {
      toast.success("Proposal accepted!");
      queryClient.invalidateQueries({ queryKey: ["proposals", requestId] });
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
    },
    onError: () => {
      toast.error("Failed to accept proposal");
    },
  });

  const rejectProposalMutation = useMutation({
    mutationFn: (proposalId: string) =>
      proposalService.rejectProposal(proposalId),
    onSuccess: () => {
      toast.success("Proposal rejected");
      queryClient.invalidateQueries({ queryKey: ["proposals", requestId] });
    },
    onError: () => {
      toast.error("Failed to reject proposal");
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: () => requestService.cancelRequest(requestId),
    onSuccess: () => {
      toast.success("Request cancelled");
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
    },
    onError: () => {
      toast.error("Failed to cancel request");
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <p>Request not found</p>
        </div>
      </Layout>
    );
  }

  const isOwner = user?.id === request.user_id;
  // Total proposal count comes from request data (always available regardless of role)
  const totalProposalCount = (request as any).proposal_count ?? proposals?.length ?? 0;

  return (
    <ProtectedRoute requiredPermissions={[Permission.REQUESTS_READ]}>
      <Layout>
        <div className="container-custom py-8">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Request Details */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">
                        Service Request #
                        {request.display_id || request.id.slice(0, 8)}
                      </h1>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {request.category && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            {request.category.name}
                          </span>
                        )}
                        <p className="text-sm text-gray-500">
                          Posted {formatRelativeTime(request.created_at)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Description
                      </h3>
                      <p className="text-gray-900 whitespace-pre-wrap break-words">
                        {request.description}
                      </p>
                    </div>

                    {/* Service Location */}
                    {request.location &&
                      request.location.latitude &&
                      request.location.longitude && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-primary-600" />
                            Service Location
                          </h3>
                          {request.location.address && (
                            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-900">
                                {request.location.address}
                              </p>
                              {(request.location.city ||
                                request.location.state ||
                                request.location.zip_code) && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {[
                                    request.location.city,
                                    request.location.state,
                                    request.location.zip_code,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                          <LocationMap
                            latitude={request.location.latitude}
                            longitude={request.location.longitude}
                            address={request.location.address}
                            height="300px"
                            zoom={15}
                          />
                        </div>
                      )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-gray-500">Budget</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(request.budget)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Category</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {request.category?.name || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Attached images — public URLs, no extra API call needed */}
                    {Array.isArray(request.images) && request.images.length > 0 && (
                      <div className="pt-4 border-t">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Attached Images ({request.images.length})
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {(request.images as unknown as { id: string; url: string }[]).map(
                            (img) => (
                              <a
                                key={img.id}
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                              >
                                <img
                                  src={img.url}
                                  alt="Request attachment"
                                  className="w-full h-36 object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {isOwner && request.status === "open" && (
                      <div className="pt-4 border-t flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/dashboard/requests/${requestId}/edit`)
                          }
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Request
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setShowCancelConfirm(true)}
                          isLoading={cancelRequestMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Request
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Proposals */}
              <Card className="mt-6">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Proposals ({totalProposalCount})
                  </h2>
                </CardHeader>
                <CardContent>
                  {isProvider && !isOwner ? (
                    // Provider view: show only their own proposal (if submitted), plus total count
                    proposals && proposals.length > 0 ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-500 mb-3">
                          {totalProposalCount > 1
                            ? `${totalProposalCount} providers have submitted proposals. Your proposal:`
                            : "Your proposal:"}
                        </p>
                        {proposals.map((proposal) => (
                          <div key={proposal.id} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-semibold text-gray-900">Your Proposal</p>
                                <p className="text-sm text-gray-500">
                                  {formatRelativeTime(proposal.created_at)}
                                </p>
                              </div>
                              <StatusBadge status={proposal.status} />
                            </div>
                            <p className="text-gray-700 mb-3">{proposal.message}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="font-medium text-gray-900">
                                Price: {formatCurrency(proposal.price)}
                              </span>
                              {proposal.estimated_hours && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-600">
                                    Duration: {proposal.estimated_hours} hours
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500 mb-1">
                          {totalProposalCount > 0
                            ? `${totalProposalCount} proposal${totalProposalCount !== 1 ? "s" : ""} submitted by other providers.`
                            : "No proposals submitted yet."}
                        </p>
                        <p className="text-sm text-gray-400">
                          You have not submitted a proposal for this request yet.
                        </p>
                      </div>
                    )
                  ) : proposals && proposals.length > 0 ? (
                    // Owner / admin view: see all proposals
                    <div className="space-y-4">
                      {proposals.map((proposal) => (
                        <div
                          key={proposal.id}
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {proposal.provider?.name || "Provider"}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {formatRelativeTime(proposal.created_at)}
                              </p>
                            </div>
                            <StatusBadge status={proposal.status} />
                          </div>

                          <p className="text-gray-700 mb-3">
                            {proposal.message}
                          </p>

                          <div className="flex items-center gap-4 mb-3 text-sm">
                            <span className="font-medium text-gray-900">
                              Price: {formatCurrency(proposal.price)}
                            </span>
                            {proposal.estimated_hours && (
                              <>
                                <span>•</span>
                                <span className="text-gray-600">
                                  Duration: {proposal.estimated_hours} hours
                                </span>
                              </>
                            )}
                          </div>

                          {isOwner && proposal.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  acceptProposalMutation.mutate(proposal.id)
                                }
                                isLoading={acceptProposalMutation.isPending}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  rejectProposalMutation.mutate(proposal.id)
                                }
                                isLoading={rejectProposalMutation.isPending}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-500">
                      No proposals yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div>
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-900">Request Info</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-500">Status</p>
                      <StatusBadge status={request.status} />
                    </div>
                    <div>
                      <p className="text-gray-500">Created</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(request.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last Updated</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(request.updated_at)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Layout>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false);
          cancelRequestMutation.mutate();
        }}
        title="Cancel Request"
        message="Are you sure you want to cancel this request? This action cannot be undone."
        confirmLabel="Cancel Request"
        variant="danger"
        isLoading={cancelRequestMutation.isPending}
      />
    </ProtectedRoute>
  );
}
