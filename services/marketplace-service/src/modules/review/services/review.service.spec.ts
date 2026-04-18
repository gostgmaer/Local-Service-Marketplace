/// <reference types="jest" />

import { ReviewService } from "./review.service";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "../../../common/exceptions/http.exceptions";

const makeLogger = () =>
  ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }) as any;
const makeQueue = () => ({ add: jest.fn().mockResolvedValue(undefined) }) as any;
const makeKafka = () => ({
  isKafkaEnabled: jest.fn().mockReturnValue(false),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}) as any;

const completedJob = {
  id: "job-1",
  status: "completed",
  customer_id: "cust-1",
  provider_id: "prov-1",
  completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
};

const baseReview = {
  id: "rev-1",
  job_id: "job-1",
  user_id: "cust-1",
  provider_id: "prov-1",
  rating: 5,
  comment: "Excellent service provided by the team",
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
};

function createService(repoOverrides: Partial<{
  getJobForReview: jest.Mock;
  getSystemSetting: jest.Mock;
  createReview: jest.Mock;
  getReviewById: jest.Mock;
  updateReview: jest.Mock;
  deleteReview: jest.Mock;
  getProviderReviews: jest.Mock;
  getProviderRating: jest.Mock;
  getReviewsByUser: jest.Mock;
}> = {}) {
  const reviewRepository = {
    getJobForReview: repoOverrides.getJobForReview ?? jest.fn().mockResolvedValue(completedJob),
    getSystemSetting: repoOverrides.getSystemSetting ?? jest.fn().mockImplementation((key: string) => {
      if (key === "review_submission_window_days") return Promise.resolve("90");
      return Promise.resolve("10"); // default for min_review_length etc.
    }),
    createReview: repoOverrides.createReview ?? jest.fn().mockResolvedValue(baseReview),
    getReviewById: repoOverrides.getReviewById ?? jest.fn().mockResolvedValue(baseReview),
    updateReview: repoOverrides.updateReview ?? jest.fn().mockResolvedValue(baseReview),
    deleteReview: repoOverrides.deleteReview ?? jest.fn().mockResolvedValue(undefined),
    getProviderReviews: repoOverrides.getProviderReviews ?? jest.fn().mockResolvedValue([baseReview]),
    getProviderRating: repoOverrides.getProviderRating ?? jest.fn().mockResolvedValue({ averageRating: 4.8, totalReviews: 12 }),
    getReviewsByUser: repoOverrides.getReviewsByUser ?? jest.fn().mockResolvedValue({ data: [baseReview], total: 1 }),
  };

  const service = new ReviewService(
    reviewRepository as any,
    makeLogger(),
    { sendEmail: jest.fn().mockResolvedValue(undefined) } as any,
    { getUserEmail: jest.fn().mockResolvedValue(null) } as any,
    makeKafka(),
    makeQueue(), // notificationQueue
    makeQueue(), // ratingQueue
  );

  return { service, reviewRepository };
}

describe("ReviewService.createReview", () => {
  const validDto = {
    job_id: "job-1",
    user_id: "cust-1",
    provider_id: "prov-1",
    rating: 5,
    comment: "Excellent service provided by the team",
  };

  it("throws NotFoundException when job does not exist", async () => {
    const { service } = createService({
      getJobForReview: jest.fn().mockResolvedValue(null),
    });
    await expect(service.createReview({ ...validDto })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequestException when job is not completed", async () => {
    const { service } = createService({
      getJobForReview: jest.fn().mockResolvedValue({ ...completedJob, status: "in_progress" }),
    });
    await expect(service.createReview({ ...validDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when outside submission window", async () => {
    const oldJob = {
      ...completedJob,
      completed_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
    };
    const { service } = createService({
      getJobForReview: jest.fn().mockResolvedValue(oldJob),
      getSystemSetting: jest.fn().mockResolvedValue("90"), // 90-day window
    });
    await expect(service.createReview({ ...validDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws ForbiddenException when reviewer is not the job customer", async () => {
    const { service } = createService();
    await expect(
      service.createReview({ ...validDto, user_id: "other-user" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws BadRequestException when comment is too short", async () => {
    const { service } = createService({
      getSystemSetting: jest.fn().mockResolvedValue("10"),
    });
    await expect(
      service.createReview({ ...validDto, comment: "Ok" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when duplicate review (repo returns null)", async () => {
    const { service } = createService({
      createReview: jest.fn().mockResolvedValue(null),
    });
    await expect(service.createReview({ ...validDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates review and returns review entity", async () => {
    const { service } = createService();
    const result = await service.createReview({ ...validDto });
    expect(result.id).toBe("rev-1");
    expect(result.rating).toBe(5);
  });

  it("derives provider_id from job, ignoring client-supplied value", async () => {
    const { service, reviewRepository } = createService();
    const dto = { ...validDto, provider_id: "fake-provider" };
    await service.createReview(dto);
    // provider_id should be overwritten with completedJob.provider_id
    expect(reviewRepository.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ provider_id: "prov-1" }),
    );
  });

  it("skips submission window check when job has no completed_at", async () => {
    const { service, reviewRepository } = createService({
      getJobForReview: jest.fn().mockResolvedValue({ ...completedJob, completed_at: null }),
    });
    await service.createReview({ ...validDto });
    expect(reviewRepository.createReview).toHaveBeenCalled();
  });
});

describe("ReviewService.getReviewById", () => {
  it("returns review when found", async () => {
    const { service } = createService();
    const result = await service.getReviewById("rev-1");
    expect(result.id).toBe("rev-1");
  });

  it("throws NotFoundException when review not found", async () => {
    const { service } = createService({
      getReviewById: jest.fn().mockResolvedValue(null),
    });
    await expect(service.getReviewById("missing")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("ReviewService.updateReview", () => {
  it("throws NotFoundException when review does not exist", async () => {
    const { service } = createService({
      getReviewById: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.updateReview("missing", { rating: 4 }),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws BadRequestException when review is older than 30 days", async () => {
    const oldReview = {
      ...baseReview,
      created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    };
    const { service } = createService({
      getReviewById: jest.fn().mockResolvedValue(oldReview),
    });
    await expect(
      service.updateReview("rev-1", { comment: "Updated comment here" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("updates review and returns updated entity", async () => {
    const updated = { ...baseReview, comment: "Updated comment text" };
    const { service } = createService({
      updateReview: jest.fn().mockResolvedValue(updated),
    });
    const result = await service.updateReview("rev-1", { comment: "Updated comment text" });
    expect(result.comment).toBe("Updated comment text");
  });

  it("enqueues rating recalculation when rating is changed", async () => {
    const { service } = createService();
    const ratingQueue = (service as any).ratingQueue as { add: jest.Mock };
    await service.updateReview("rev-1", { rating: 3 });
    expect(ratingQueue.add).toHaveBeenCalledWith(
      "recalculate-provider-rating",
      expect.objectContaining({ providerId: "prov-1" }),
    );
  });

  it("does not enqueue rating recalculation when only comment changed", async () => {
    const { service } = createService();
    const ratingQueue = (service as any).ratingQueue as { add: jest.Mock };
    await service.updateReview("rev-1", { comment: "Just updating comment" });
    expect(ratingQueue.add).not.toHaveBeenCalled();
  });
});

describe("ReviewService.deleteReview", () => {
  it("throws NotFoundException when review does not exist", async () => {
    const { service } = createService({
      getReviewById: jest.fn().mockResolvedValue(null),
    });
    await expect(service.deleteReview("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("deletes review and enqueues rating recalculation", async () => {
    const { service, reviewRepository } = createService();
    const ratingQueue = (service as any).ratingQueue as { add: jest.Mock };

    await service.deleteReview("rev-1");

    expect(reviewRepository.deleteReview).toHaveBeenCalledWith("rev-1");
    expect(ratingQueue.add).toHaveBeenCalledWith(
      "recalculate-provider-rating",
      expect.objectContaining({ providerId: "prov-1" }),
    );
  });
});

describe("ReviewService.getProviderReviews", () => {
  it("returns reviews with rating data", async () => {
    const { service } = createService();
    const result = await service.getProviderReviews("prov-1");
    expect(result.data).toHaveLength(1);
    expect(result.averageRating).toBe(4.8);
    expect(result.total).toBe(12);
  });
});

describe("ReviewService.getProviderRating", () => {
  it("returns average rating and total reviews", async () => {
    const { service } = createService();
    const result = await service.getProviderRating("prov-1");
    expect(result.averageRating).toBe(4.8);
    expect(result.totalReviews).toBe(12);
  });
});

describe("ReviewService.getReviewsByUser", () => {
  it("returns paginated reviews for a user", async () => {
    const { service } = createService();
    const result = await service.getReviewsByUser("cust-1");
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
