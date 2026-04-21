"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { createReview } from "@/services/review-service";
import { analytics } from "@/utils/analytics";
import toast from "react-hot-toast";
import { Star } from "lucide-react";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  comment: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(500, "Review must not exceed 500 characters"),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface SubmitReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  providerId: string;
  onSuccess?: () => void;
}

export function SubmitReviewModal({
  isOpen,
  onClose,
  jobId,
  providerId,
  onSuccess,
}: SubmitReviewModalProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: "" },
  });

  const submitMutation = useMutation({
    mutationFn: (data: ReviewFormData) =>
      createReview({
        job_id: jobId,
        provider_id: providerId,
        rating: data.rating,
        comment: data.comment,
      }),
    onSuccess: () => {
      toast.success("Review submitted successfully!");
      analytics.event({
        action: "review_submitted",
        category: "engagement",
        label: "Job Review",
        value: rating,
      });
      queryClient.invalidateQueries({ queryKey: ["job-review", jobId] });
      reset();
      setRating(0);
      onClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message || "Failed to submit review";
      toast.error(message);
      analytics.trackError(message, "ReviewSubmit");
    },
  });

  const handleRatingClick = (value: number) => {
    setRating(value);
    setValue("rating", value);
  };

  const handleClose = () => {
    reset();
    setRating(0);
    onClose();
  };

  const onSubmit = (data: ReviewFormData) => {
    submitMutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Leave a Review" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Star Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleRatingClick(value)}
                onMouseEnter={() => setHoverRating(value)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                aria-label={`Rate ${value} star${value !== 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-9 w-9 transition-colors ${
                    value <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                />
              </button>
            ))}
          </div>
          {errors.rating && (
            <p className="mt-1 text-sm text-red-600">{errors.rating.message}</p>
          )}
        </div>

        {/* Comment */}
        <div>
          <Textarea
            label="Your Review *"
            {...register("comment")}
            rows={5}
            placeholder="Share your experience with this provider. What did you like? What could be improved?"
          />
          {errors.comment && (
            <p className="mt-1 text-sm text-red-600">{errors.comment.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">Minimum 10 characters</p>
        </div>

        {/* Guidelines */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p className="font-medium text-gray-700 dark:text-gray-300">Guidelines:</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>Be honest and specific about your experience</li>
            <li>Focus on professionalism and service quality</li>
            <li>Avoid personal attacks or inappropriate language</li>
            <li>Reviews cannot be edited once submitted</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            isLoading={submitMutation.isPending}
            disabled={submitMutation.isPending || rating === 0}
            className="bg-amber-500 hover:bg-amber-600"
          >
            Submit Review
          </Button>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
