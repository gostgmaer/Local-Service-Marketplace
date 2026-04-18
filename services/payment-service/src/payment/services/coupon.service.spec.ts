/// <reference types="jest" />

import { CouponService } from "./coupon.service";
import {
  NotFoundException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";

const makeLogger = () =>
  ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }) as any;

const baseCoupon = {
  id: "coup-1",
  code: "SAVE10",
  discount_percent: 10,
  active: true,
  expires_at: null,
  max_uses: null,
  min_purchase_amount: null,
};

function createService(repoOverrides: Partial<{
  getCouponByCode: jest.Mock;
  getCouponUsageCount: jest.Mock;
  recordCouponUsage: jest.Mock;
  getSystemSetting: jest.Mock;
}> = {}) {
  const couponRepository = {
    getCouponByCode: repoOverrides.getCouponByCode ?? jest.fn().mockResolvedValue(baseCoupon),
    getCouponUsageCount: repoOverrides.getCouponUsageCount ?? jest.fn().mockResolvedValue(0),
    recordCouponUsage: repoOverrides.recordCouponUsage ?? jest.fn().mockResolvedValue({ id: "usage-1" }),
    getSystemSetting: repoOverrides.getSystemSetting ?? jest.fn().mockResolvedValue("80"),
  };

  const service = new CouponService(makeLogger(), couponRepository as any);

  return { service, couponRepository };
}

describe("CouponService.validateCoupon", () => {
  it("throws NotFoundException when coupon code does not exist", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue(null),
    });
    await expect(service.validateCoupon("NOPE")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequestException when coupon is inactive", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, active: false }),
    });
    await expect(service.validateCoupon("SAVE10")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when coupon has expired", async () => {
    const expired = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, expires_at: expired }),
    });
    await expect(service.validateCoupon("SAVE10")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when global usage limit is reached", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, max_uses: 100 }),
      getCouponUsageCount: jest.fn().mockResolvedValue(100),
    });
    await expect(service.validateCoupon("SAVE10")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("returns valid coupon when all checks pass", async () => {
    const { service } = createService();
    const result = await service.validateCoupon("SAVE10");
    expect(result.id).toBe("coup-1");
    expect(result.discount_percent).toBe(10);
  });

  it("accepts coupon with future expiry date", async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, expires_at: future }),
    });
    const result = await service.validateCoupon("SAVE10");
    expect(result.id).toBe("coup-1");
  });

  it("accepts coupon with max_uses not yet exhausted", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, max_uses: 100 }),
      getCouponUsageCount: jest.fn().mockResolvedValue(50),
    });
    const result = await service.validateCoupon("SAVE10");
    expect(result.id).toBe("coup-1");
  });
});

describe("CouponService.validateAndUseCoupon", () => {
  it("throws BadRequestException when purchase amount is below minimum", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({
        ...baseCoupon,
        min_purchase_amount: 500,
      }),
    });
    await expect(
      service.validateAndUseCoupon("SAVE10", "user-1", 200),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when coupon is already used (race guard)", async () => {
    const { service } = createService({
      recordCouponUsage: jest.fn().mockResolvedValue(null), // null = already used
    });
    await expect(
      service.validateAndUseCoupon("SAVE10", "user-1"),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns the coupon discount percentage on success", async () => {
    const { service } = createService();
    const discount = await service.validateAndUseCoupon("SAVE10", "user-1");
    expect(discount).toBe(10);
  });

  it("caps discount at platform maximum", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, discount_percent: 95 }),
      getSystemSetting: jest.fn().mockResolvedValue("80"), // max is 80%
    });
    const discount = await service.validateAndUseCoupon("SAVE10", "user-1");
    expect(discount).toBe(80);
  });

  it("does not cap discount when it is below maximum", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, discount_percent: 15 }),
      getSystemSetting: jest.fn().mockResolvedValue("80"),
    });
    const discount = await service.validateAndUseCoupon("SAVE10", "user-1");
    expect(discount).toBe(15);
  });

  it("records coupon usage for the given user", async () => {
    const { service, couponRepository } = createService();
    await service.validateAndUseCoupon("SAVE10", "user-42");
    expect(couponRepository.recordCouponUsage).toHaveBeenCalledWith(
      "coup-1",
      "user-42",
    );
  });

  it("allows usage when purchase amount equals minimum", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue({ ...baseCoupon, min_purchase_amount: 100 }),
    });
    const discount = await service.validateAndUseCoupon("SAVE10", "user-1", 100);
    expect(discount).toBe(10);
  });
});

describe("CouponService.getCouponByCode", () => {
  it("delegates to validateCoupon and returns coupon", async () => {
    const { service } = createService();
    const result = await service.getCouponByCode("SAVE10");
    expect(result.code).toBe("SAVE10");
  });

  it("propagates NotFoundException for unknown codes", async () => {
    const { service } = createService({
      getCouponByCode: jest.fn().mockResolvedValue(null),
    });
    await expect(service.getCouponByCode("FAKE")).rejects.toThrow(
      NotFoundException,
    );
  });
});
