"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Permission } from "@/utils/permissions";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";

import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { proposalService } from "@/services/proposal-service";
import { formatRelativeTime, formatDateTime, formatCurrency } from "@/utils/helpers";
import {
  FileText,
  Calendar,
  IndianRupee,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Pencil,
} from "lucide-react";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import toast from "react-hot-toast";

export default function MyProposalsPage() {
  const queryClient = useQueryClient();
  const { user: _user, isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(
    null,
  );
  const [editProposalId, setEditProposalId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editHours, setEditHours] = useState("");

  // Fetch provider's proposals
  const {
    data: proposals,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-proposals"],
    queryFn: () => proposalService.getMyProposals(),
    enabled: isAuthenticated && can(Permission.PROPOSALS_CREATE),
  });

  // Withdraw proposal mutation
  const withdrawMutation = useMutation({
    mutationFn: (proposalId: string) =>
      proposalService.withdrawProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-proposals"] });
    },
  });

  // Edit proposal mutation
  const editMutation = useMutation({
    mutationFn: ({ id, price, message, estimated_hours }: { id: string; price: number; message: string; estimated_hours?: number }) =>
      proposalService.updateProposal(id, { price, message, estimated_hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-proposals"] });
      setEditProposalId(null);
      toast.success("Proposal updated successfully");
    },
    onError: () => toast.error("Failed to update proposal"),
  });

  const handleOpenEdit = (proposal: any) => {
    setEditProposalId(proposal.id);
    setEditPrice(String(proposal.price));
    setEditMessage(proposal.message || "");
    setEditHours(proposal.estimated_hours ? String(proposal.estimated_hours) : "");
  };

  const handleSubmitEdit = () => {
    if (!editProposalId) return;
    const price = parseFloat(editPrice);
    if (!price || price <= 0) { toast.error("Price must be a positive number"); return; }
    if (!editMessage.trim()) { toast.error("Message is required"); return; }
    editMutation.mutate({ id: editProposalId, price, message: editMessage.trim(), estimated_hours: editHours ? Number(editHours) : undefined });
  };

  // Filter proposals by status
  const filteredProposals =
    proposals?.filter((proposal: any) => {
      if (!statusFilter) return true;
      return proposal.status === statusFilter;
    }) || [];

  // Group proposals by status
  const proposalStats = {
    pending: proposals?.filter((p: any) => p.status === "pending").length || 0,
    accepted:
      proposals?.filter((p: any) => p.status === "accepted").length || 0,
    rejected:
      proposals?.filter((p: any) => p.status === "rejected").length || 0,
    withdrawn:
      proposals?.filter((p: any) => p.status === "withdrawn").length || 0,
  };

  const handleWithdraw = (proposalId: string) => {
    setPendingProposalId(proposalId);
    setWithdrawConfirmOpen(true);
  };

  const handleConfirmWithdraw = () => {
    if (pendingProposalId) {
      withdrawMutation.mutate(pendingProposalId);
    }
    setWithdrawConfirmOpen(false);
    setPendingProposalId(null);
  };

  return (
    <ProtectedRoute requiredPermissions={[Permission.PROPOSALS_CREATE]}>
      <Layout>
        <div className="container-custom py-12">
          {error ? (
            <ErrorState
              title="Failed to load proposals"
              message="We couldn't load your proposals. Please try again."
              retry={() => refetch()}
            />
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
                  My Proposals
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Track and manage your submitted proposals
                </p>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card hover>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Pending
                        </p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {proposalStats.pending}
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card hover>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Accepted
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {proposalStats.accepted}
                        </p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card hover>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Rejected
                        </p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {proposalStats.rejected}
                        </p>
                      </div>
                      <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card hover>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Withdrawn
                        </p>
                        <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                          {proposalStats.withdrawn}
                        </p>
                      </div>
                      <AlertCircle className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filter */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="proposal-status-filter">
                      Filter by status:
                    </label>
                    <select
                      id="proposal-status-filter"
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                    {statusFilter && (
                      <>
                        <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
                          Filtered: {statusFilter}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("")}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Proposals List */}
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : filteredProposals.length > 0 ? (
                <div className="space-y-4">
                  {filteredProposals.map((proposal: any) => (
                    <Card key={proposal.id} hover>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                  Proposal #
                                  {proposal.display_id ||
                                    proposal.id.substring(0, 8)}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  For Request #
                                  {proposal.request_id?.substring(0, 8)}
                                </p>
                              </div>
                              <StatusBadge status={proposal.status} />
                            </div>

                            {/* Message */}
                            <div className="mb-4">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Cover Letter:
                              </p>
                              <p className="text-gray-700 dark:text-gray-300 line-clamp-3">
                                {proposal.message}
                              </p>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <IndianRupee className="h-4 w-4 mr-2" />
                                <span>
                                  Bid: {formatCurrency(proposal.price)}
                                </span>
                              </div>
                              {proposal.estimated_hours && (
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                  <Clock className="h-4 w-4 mr-2" />
                                  <span>{proposal.estimated_hours} hours</span>
                                </div>
                              )}
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Calendar className="h-4 w-4 mr-2" />
                                <span>
                                  Submitted {formatRelativeTime(proposal.created_at)}
                                </span>
                              </div>
                            </div>

                            {/* Timeline */}
                            {(proposal.start_date ||
                              proposal.completion_date) && (
                              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Proposed Timeline:
                                </p>
                                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
                                  {proposal.start_date && (
                                    <div>
                                      <span className="font-medium">
                                        Start:
                                      </span>{" "}
                                      {formatDateTime(proposal.start_date)}
                                    </div>
                                  )}
                                  {proposal.completion_date && (
                                    <div>
                                      <span className="font-medium">
                                        Complete:
                                      </span>{" "}
                                      {formatDateTime(proposal.completion_date)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Rejection Reason */}
                            {proposal.status === "rejected" &&
                              proposal.rejected_reason && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                                  <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                                    Rejection Reason:
                                  </p>
                                  <p className="text-sm text-red-700 dark:text-red-400">
                                    {proposal.rejected_reason}
                                  </p>
                                </div>
                              )}
                          </div>

                          {/* Actions */}
                          <div className="ml-4 flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                router.push(
                                  ROUTES.DASHBOARD_REQUEST_DETAIL(
                                    proposal.request_id,
                                  ),
                                )
                              }
                            >
                              View Request
                            </Button>
                            {proposal.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenEdit(proposal)}
                                  aria-label="Edit proposal"
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleWithdraw(proposal.id)}
                                  disabled={withdrawMutation.isPending}
                                >
                                  {withdrawMutation.isPending
                                    ? "Withdrawing..."
                                    : "Withdraw"}
                                </Button>
                              </>
                            )}
                            {proposal.status === "accepted" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  router.push(ROUTES.DASHBOARD_JOBS)
                                }
                              >
                                View Job
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No proposals found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {statusFilter
                        ? `No ${statusFilter} proposals`
                        : "You haven't submitted any proposals yet"}
                    </p>
                    <Button
                      onClick={() =>
                        router.push(ROUTES.DASHBOARD_BROWSE_REQUESTS)
                      }
                    >
                      Browse Requests
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Results Summary */}
              {!isLoading && filteredProposals.length > 0 && (
                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredProposals.length} of {proposals?.length || 0}{" "}
                  proposal
                  {proposals?.length !== 1 ? "s" : ""}
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
      <ConfirmDialog
        isOpen={withdrawConfirmOpen}
        onClose={() => {
          setWithdrawConfirmOpen(false);
          setPendingProposalId(null);
        }}
        onConfirm={handleConfirmWithdraw}
        title="Withdraw Proposal"
        message="Are you sure you want to withdraw this proposal? This action cannot be undone."
        confirmLabel="Withdraw"
        variant="warning"
        isLoading={withdrawMutation.isPending}
      />

      {/* Edit Proposal Modal */}
      {editProposalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Proposal</h2>
              <button
                onClick={() => setEditProposalId(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                aria-label="Close edit modal"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (₹) *</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cover Letter *</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white resize-none"
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Hours</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                  value={editHours}
                  placeholder="Optional"
                  onChange={(e) => setEditHours(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditProposalId(null)}>Cancel</Button>
                <Button onClick={handleSubmitEdit} isLoading={editMutation.isPending}>Save Changes</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
