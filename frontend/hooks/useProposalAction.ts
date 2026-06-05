import { useOptimisticMutation } from "./useOptimisticMutation";
import { proposalService, Proposal } from "@/services/proposal-service";
import toast from "react-hot-toast";

interface ProposalActionVariables {
  proposalId: string;
  action: "accept" | "reject";
  requestId: string;
}

/**
 * Hook for optimistic proposal accept/reject
 * Immediately updates UI, rollback on error
 */
export function useProposalAction() {
  return useOptimisticMutation<Proposal, ProposalActionVariables>({
    // Base key — React Query partial matching will invalidate all variants.
    // updateFn handles both flat-array and paginated { data: Proposal[] } shapes.
    queryKey: ["proposals"],
    mutationFn: async ({ proposalId, action }) => {
      if (action === "accept") {
        return await proposalService.acceptProposal(proposalId);
      } else {
        return await proposalService.rejectProposal(proposalId);
      }
    },
    updateFn: (oldData: any, { proposalId, action }) => {
      if (!oldData) return oldData;
      const newStatus = action === "accept" ? "accepted" : "rejected";
      // Handle paginated shape: { data: Proposal[], total, ... }
      if (oldData?.data && Array.isArray(oldData.data)) {
        return {
          ...oldData,
          data: oldData.data.map((p: Proposal) =>
            p.id === proposalId ? { ...p, status: newStatus } : p,
          ),
        };
      }
      // Handle flat array shape
      if (Array.isArray(oldData)) {
        return oldData.map((p: Proposal) =>
          p.id === proposalId ? { ...p, status: newStatus } : p,
        );
      }
      return oldData;
    },
    successMessage: "Proposal updated successfully",
    errorMessage: "Failed to update proposal",
    onSuccess: (data, variables) => {
      // Show specific success message based on action
      const message = `Proposal ${variables.action === "accept" ? "accepted" : "rejected"} successfully`;
      toast.success(message);
    },
  });
}
