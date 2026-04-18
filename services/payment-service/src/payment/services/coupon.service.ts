import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { CouponRepository } from "../repositories/coupon.repository";
import { Coupon } from "../entities/coupon.entity";
import {
  NotFoundException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";

@Injectable()
export class CouponService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly couponRepository: CouponRepository,
  ) {}

  async validateCoupon(code: string): Promise<Coupon> {
    this.logger.log(`Validating coupon ${code}`, "CouponService");

    const coupon = await this.couponRepository.getCouponByCode(code);
    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }

    // Check if coupon is active
    if (!(coupon as any).active) {
      throw new BadRequestException("Coupon is no longer active");
    }

    // Check if coupon is expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      throw new BadRequestException("Coupon has expired");
    }

    // Check global usage cap
    const maxUses = (coupon as any).max_uses;
    if (maxUses != null) {
      const usageCount = await this.couponRepository.getCouponUsageCount(
        coupon.id,
      );
      if (usageCount >= maxUses) {
        throw new BadRequestException("Coupon usage limit has been reached");
      }
    }

    return coupon;
  }

  async validateAndUseCoupon(
    code: string,
    userId: string,
    purchaseAmount?: number,
  ): Promise<number> {
    const coupon = await this.validateCoupon(code);

    // Enforce minimum purchase amount gate
    if (
      coupon.min_purchase_amount != null &&
      purchaseAmount != null &&
      purchaseAmount < coupon.min_purchase_amount
    ) {
      throw new BadRequestException(
        `This coupon requires a minimum purchase amount of ₹${coupon.min_purchase_amount}. Your order total is ₹${purchaseAmount}.`,
      );
    }

    // Record coupon usage atomically — ON CONFLICT (coupon_id, user_id) DO NOTHING
    // returns null when a concurrent request already inserted the row (race condition guard)
    const usage = await this.couponRepository.recordCouponUsage(
      coupon.id,
      userId,
    );
    if (!usage) {
      throw new BadRequestException("Coupon has already been used");
    }

    // Cap discount at platform maximum (system_settings.max_coupon_discount_percentage)
    const maxPctStr = await this.couponRepository.getSystemSetting(
      "max_coupon_discount_percentage",
      "80",
    );
    const maxPct = parseFloat(maxPctStr);
    const effectiveDiscount = isNaN(maxPct)
      ? coupon.discount_percent
      : Math.min(coupon.discount_percent, maxPct);

    this.logger.log(
      `Coupon ${code} applied for user ${userId} — effective discount: ${effectiveDiscount}%`,
      "CouponService",
    );
    return effectiveDiscount;
  }

  async getCouponByCode(code: string): Promise<Coupon> {
    return this.validateCoupon(code);
  }
}
