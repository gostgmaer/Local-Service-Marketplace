"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { proposalService } from "@/services/proposal-service";
import {
  createProposalSchema,
  type CreateProposalFormData,
} from "@/schemas/proposal.schema";

import toast from "react-hot-toast";

interface CreateProposalFormProps {
  requestId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateProposalForm({
  requestId,
  onSuccess,
  onCancel,
}: CreateProposalFormProps) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createProposalSchema),
    defaultValues: {
      price: 0,
      estimated_hours: undefined,
      message: "",
    },
    mode: "onChange",
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  const messageValue = watch("message") ?? "";

  const createMutation = useMutation({
    mutationFn: (data: CreateProposalFormData) =>
      proposalService.createProposal(requestId, data),
    onSuccess: () => {
      toast.success("Proposal submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["proposals", requestId] });
      onSuccess?.();
    },
    onError: (error: any) => {
      const status = error.response?.status;
      const errorMessage =
        status === 409
          ? "You already have an active proposal for this request"
          : error.response?.data?.error?.message ||
            error.response?.data?.message ||
            "Failed to submit proposal";
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data as CreateProposalFormData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Input
          label="Your Price"
          type="number"
          {...register("price", { valueAsNumber: true })}
          min="0"
          step="0.01"
          placeholder="Enter your price"
        />
        {errors.price && (
          <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
        )}
      </div>

      <div>
        <Input
          label="Estimated Hours (Optional)"
          type="number"
          {...register("estimated_hours", { valueAsNumber: true })}
          min="0"
          step="0.5"
          placeholder="e.g., 2, 8, 24"
        />
        {errors.estimated_hours && (
          <p className="mt-1 text-sm text-red-600">
            {errors.estimated_hours.message}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          How many hours do you estimate this work will take?
        </p>
      </div>

      <div>
        <Textarea
          label="Your Proposal Message"
          {...register("message")}
          rows={6}
          placeholder="Describe your approach, experience, and why you're the best fit for this job (minimum 20 characters)..."
        />
        <div className="mt-1 flex items-center justify-between">
          <div>
            {errors.message && (
              <p className="text-sm text-red-600">{errors.message.message}</p>
            )}
          </div>
          <span className={`text-xs ${
            messageValue.length > 1000
              ? "text-red-500"
              : messageValue.length >= 900
                ? "text-yellow-500"
                : "text-gray-400"
          }`}>
            {messageValue.length} / 1000
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          isLoading={createMutation.isPending}
          disabled={createMutation.isPending}
        >
          Submit Proposal
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
