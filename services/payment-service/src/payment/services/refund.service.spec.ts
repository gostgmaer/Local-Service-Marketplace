/// <reference types="jest" />

import { RefundService } from "./refund.service";
import {
  NotFoundException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";

const makeLogger = () =>
  ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }) as any;
const makeQueue = () => ({ add: jest.fn().mockResolvedValue({}) }) as any;

const basePayment = {
  id: "pay-1",
  status: "completed",
  amount: 200,
  paid_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
};

function createService(overrides: {
  paymentRepository?: any;
  refundRepository?: any;
} = {}) {
  const paymentRepository = overrides.paymentRepository ?? {
    getPaymentById: jest.fn().mockResolvedValue(basePayment),
    getSystemSetting: jest.fn().mockResolvedValue("30"),
  };
  const refundRepository = overrides.refundRepository ?? {
    createRefund: jest.fn().mockResolvedValue({ id: "ref-1", amount: 200, status: "pending" }),
    getRefundById: jest.fn().mockResolvedValue({ id: "ref-1", amount: 200, status: "pending" }),
    getRefundsByPaymentId: jest.fn().mockResolvedValue([]),
  };

  const service = new RefundService(
    makeLogger(),
    makeQueue(), // refundQueue
    makeQueue(), // notificationQueue
    refundRepository,
    paymentRepository,
    { sendEmail: jest.fn() } as any,
    { getUserById: jest.fn() } as any,
  );

  return { service, paymentRepository, refundRepository };
}

describe("RefundService.createRefund", () => {
  it("throws NotFoundException when payment not found", async () => {
    const { service } = createService({
      paymentRepository: {
        getPaymentById: jest.fn().mockResolvedValue(null),
        getSystemSetting: jest.fn(),
      },
    });
    await expect(service.createRefund("pay-missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequestException when payment is not completed", async () => {
    const { service } = createService({
      paymentRepository: {
        getPaymentById: jest.fn().mockResolvedValue({ ...basePayment, status: "pending" }),
        getSystemSetting: jest.fn().mockResolvedValue("30"),
      },
    });
    await expect(service.createRefund("pay-1")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when outside refund window", async () => {
    const oldPaidAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
    const { service } = createService({
      paymentRepository: {
        getPaymentById: jest.fn().mockResolvedValue({ ...basePayment, paid_at: oldPaidAt }),
        getSystemSetting: jest.fn().mockResolvedValue("30"),
      },
    });
    await expect(service.createRefund("pay-1")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when refund amount exceeds payment amount", async () => {
    const { service } = createService();
    await expect(service.createRefund("pay-1", 500)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when total refunds would exceed payment amount", async () => {
    const existingRefund = { id: "ref-0", amount: 150, status: "completed" };
    const { service } = createService({
      refundRepository: {
        getRefundsByPaymentId: jest.fn().mockResolvedValue([existingRefund]),
        createRefund: jest.fn(),
      },
    });
    // payment is 200, already refunded 150, trying to refund 100 → total 250 > 200
    await expect(service.createRefund("pay-1", 100)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates full refund (no amount argument) and queues processing", async () => {
    const { service, refundRepository } = createService();

    const result = await service.createRefund("pay-1");

    expect(refundRepository.createRefund).toHaveBeenCalledWith("pay-1", 200);
    expect(result.id).toBe("ref-1");
  });

  it("creates partial refund within allowed amount", async () => {
    const { service, refundRepository } = createService();

    await service.createRefund("pay-1", 100);

    expect(refundRepository.createRefund).toHaveBeenCalledWith("pay-1", 100);
  });

  it("skips window check when payment has no paid_at", async () => {
    const { service, refundRepository } = createService({
      paymentRepository: {
        getPaymentById: jest.fn().mockResolvedValue({ ...basePayment, paid_at: null }),
        getSystemSetting: jest.fn().mockResolvedValue("30"),
      },
    });

    await service.createRefund("pay-1");

    expect(refundRepository.createRefund).toHaveBeenCalled();
  });
});

describe("RefundService.getRefundById", () => {
  it("returns refund when found", async () => {
    const { service } = createService();
    const result = await service.getRefundById("ref-1");
    expect(result.id).toBe("ref-1");
  });

  it("throws NotFoundException when refund not found", async () => {
    const { service } = createService({
      refundRepository: {
        getRefundById: jest.fn().mockResolvedValue(null),
        getRefundsByPaymentId: jest.fn().mockResolvedValue([]),
        createRefund: jest.fn(),
      },
    });
    await expect(service.getRefundById("missing")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("RefundService.getRefundsByPaymentId", () => {
  it("returns all refunds for a payment", async () => {
    const refunds = [
      { id: "ref-1", amount: 100, status: "completed" },
      { id: "ref-2", amount: 50, status: "pending" },
    ];
    const { service } = createService({
      refundRepository: {
        getRefundsByPaymentId: jest.fn().mockResolvedValue(refunds),
        getRefundById: jest.fn(),
        createRefund: jest.fn(),
      },
    });

    const result = await service.getRefundsByPaymentId("pay-1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("ref-1");
  });
});
