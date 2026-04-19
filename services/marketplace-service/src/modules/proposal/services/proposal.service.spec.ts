/// <reference types="jest" />

import { ProposalService } from "./proposal.service";
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "../../../common/exceptions/http.exceptions";

describe("ProposalService list validation", () => {
  const createService = () => {
    const proposalRepository = {
      getProposalsPaginated: jest.fn(),
      countProposals: jest.fn(),
    } as any;

    const service = new ProposalService(
      proposalRepository,
      {} as any, // jobRepository
      {} as any, // requestRepository
      {} as any, // kafkaService
      {} as any, // notificationClient
      {} as any, // userClient
      { log: jest.fn(), warn: jest.fn() } as any, // logger
      { add: jest.fn() } as any, // notificationQueue
    );

    return { service };
  };

  it("rejects min_price > max_price", async () => {
    const { service } = createService();
    await expect(
      service.getProposals({ min_price: 500, max_price: 100 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects created_from > created_to", async () => {
    const { service } = createService();
    await expect(
      service.getProposals({
        created_from: "2026-03-20",
        created_to: "2026-03-10",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects cursor with page", async () => {
    const { service } = createService();
    await expect(
      service.getProposals({ cursor: "id", page: 2 } as any),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("ProposalService.createProposal", () => {
  const baseDto = {
    request_id: "req-1",
    provider_id: "prov-1",
    price: 300,
    description: "I can do this job",
  } as any;

  const baseProposal = {
    id: "prop-1",
    request_id: "req-1",
    provider_id: "prov-1",
    price: 300,
    status: "pending",
    customer_id: "cust-1",
  };

  function makeService(repoOverrides: any = {}, userClientOverrides: any = {}) {
    const proposalRepository = {
      getRequestStatus: jest.fn().mockResolvedValue("open"),
      hasExistingProposal: jest.fn().mockResolvedValue(false),
      countProposalsByProviderForRequest: jest.fn().mockResolvedValue(0),
      getSystemSetting: jest.fn().mockResolvedValue("10"),
      createProposal: jest.fn().mockResolvedValue(baseProposal),
      getProposalById: jest.fn().mockResolvedValue(baseProposal),
      ...repoOverrides,
    } as any;

    const userClient = {
      isEnabled: jest.fn().mockReturnValue(false),
      getProviderById: jest.fn(),
      getUserById: jest.fn(),
      getProviderEmail: jest.fn().mockResolvedValue(null),
      getUserEmail: jest.fn().mockResolvedValue(null),
      ...userClientOverrides,
    } as any;

    const service = new ProposalService(
      proposalRepository,
      {} as any, // jobRepository
      {} as any, // requestRepository
      { publishEvent: jest.fn().mockResolvedValue(undefined) } as any,
      { sendEmail: jest.fn() } as any,
      userClient,
      { log: jest.fn(), warn: jest.fn() } as any,
      { add: jest.fn().mockResolvedValue(undefined) } as any,
    );

    return { service, proposalRepository, userClient };
  }

  it("throws BadRequestException when price is negative", async () => {
    const { service } = makeService();
    await expect(service.createProposal({ ...baseDto, price: -50 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws NotFoundException when service request does not exist", async () => {
    const { service } = makeService({
      getRequestStatus: jest.fn().mockResolvedValue(null),
    });
    await expect(service.createProposal({ ...baseDto })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequestException when service request is not open", async () => {
    const { service } = makeService({
      getRequestStatus: jest.fn().mockResolvedValue("assigned"),
    });
    await expect(service.createProposal({ ...baseDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws ConflictException when provider already has an active proposal", async () => {
    const { service } = makeService({
      hasExistingProposal: jest.fn().mockResolvedValue(true),
    });
    await expect(service.createProposal({ ...baseDto })).rejects.toThrow(
      ConflictException,
    );
  });

  it("throws ConflictException when provider exceeds maximum proposal count", async () => {
    const { service } = makeService({
      countProposalsByProviderForRequest: jest.fn().mockResolvedValue(10),
      getSystemSetting: jest.fn().mockResolvedValue("10"),
    });
    await expect(service.createProposal({ ...baseDto })).rejects.toThrow(
      ConflictException,
    );
  });

  it("throws BadRequestException when provider is not verified (identity-service enabled)", async () => {
    const { service } = makeService(
      { getSystemSetting: jest.fn().mockResolvedValue("10") },
      {
        isEnabled: jest.fn().mockReturnValue(true),
        getProviderById: jest.fn().mockResolvedValue({
          verification_status: "pending",
        }),
      },
    );
    await expect(service.createProposal({ ...baseDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when identity-service unavailable and verification required", async () => {
    const { service } = makeService(
      {
        getSystemSetting: jest.fn((key: string) => {
          if (key === "max_proposal_count") return Promise.resolve("10");
          if (key === "provider_verification_required") return Promise.resolve("true");
          return Promise.resolve("10");
        }),
      },
      { isEnabled: jest.fn().mockReturnValue(false) },
    );
    // When userClient is disabled but verification is required, it should fail-closed
    // Set getSystemSetting to return "true" for provider_verification_required
    const svc: any = service;
    (svc.proposalRepository.getSystemSetting as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === "provider_verification_required") return Promise.resolve("true");
        return Promise.resolve("10");
      },
    );
    await expect(service.createProposal({ ...baseDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates proposal successfully when all checks pass (verification disabled)", async () => {
    const { service, proposalRepository } = makeService({
      getSystemSetting: jest.fn((key: string) => {
        if (key === "provider_verification_required") return Promise.resolve("false");
        return Promise.resolve("10");
      }),
    });
    const result = await service.createProposal({ ...baseDto });
    expect(proposalRepository.createProposal).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "req-1", provider_id: "prov-1" }),
    );
    expect(result).toBeDefined();
  });
});

describe("ProposalService.acceptProposal", () => {
  const pendingProposal = {
    id: "prop-1",
    request_id: "req-1",
    provider_id: "prov-1",
    customer_id: "cust-1",
    status: "pending",
  };

  const acceptedProposal = { ...pendingProposal, status: "accepted" };

  function makeService(overrides: {
    proposalRepository?: any;
    jobRepository?: any;
    requestRepository?: any;
    userClient?: any;
  } = {}) {
    const proposalRepository = overrides.proposalRepository ?? {
      getProposalById: jest.fn().mockResolvedValue(pendingProposal),
      getRequestStatus: jest.fn().mockResolvedValue("open"),
      acceptProposalTransaction: jest.fn().mockResolvedValue({ proposal: acceptedProposal, job: { id: "job-1" } }),
    };
    const jobRepository = overrides.jobRepository ?? {
      createJob: jest.fn().mockResolvedValue({ id: "job-1" }),
    };
    const requestRepository = overrides.requestRepository ?? {
      updateRequest: jest.fn().mockResolvedValue(undefined),
    };
    const userClient = overrides.userClient ?? {
      getProviderById: jest.fn().mockResolvedValue({ verification_status: "verified" }),
      getProviderEmail: jest.fn().mockResolvedValue(null),
      getUserById: jest.fn().mockResolvedValue(null),
      isEnabled: jest.fn().mockReturnValue(false),
    };

    const service = new ProposalService(
      proposalRepository,
      jobRepository,
      requestRepository,
      { publishEvent: jest.fn().mockResolvedValue(undefined) } as any,
      { sendEmail: jest.fn() } as any,
      userClient,
      { log: jest.fn(), warn: jest.fn() } as any,
      { add: jest.fn().mockResolvedValue(undefined) } as any,
    );

    return { service, proposalRepository, jobRepository, requestRepository };
  }

  it("throws NotFoundException when proposal does not exist", async () => {
    const { service } = makeService({
      proposalRepository: {
        getProposalById: jest.fn().mockResolvedValue(null),
        getRequestStatus: jest.fn(),
        acceptProposal: jest.fn(),
        rejectSiblingProposals: jest.fn(),
      },
    });
    await expect(
      service.acceptProposal("missing", "cust-1", "customer"),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws ForbiddenException when non-owner attempts to accept", async () => {
    const { service } = makeService();
    await expect(
      service.acceptProposal("prop-1", "other-user", "customer"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws BadRequestException when proposal is not pending", async () => {
    const { service } = makeService({
      proposalRepository: {
        getProposalById: jest.fn().mockResolvedValue({ ...pendingProposal, status: "accepted" }),
        getRequestStatus: jest.fn(),
        acceptProposal: jest.fn(),
        rejectSiblingProposals: jest.fn(),
      },
    });
    await expect(
      service.acceptProposal("prop-1", "cust-1", "customer"),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when parent request is no longer open", async () => {
    const { service } = makeService({
      proposalRepository: {
        getProposalById: jest.fn().mockResolvedValue(pendingProposal),
        getRequestStatus: jest.fn().mockResolvedValue("assigned"),
        acceptProposal: jest.fn(),
        rejectSiblingProposals: jest.fn(),
      },
    });
    await expect(
      service.acceptProposal("prop-1", "cust-1", "customer"),
    ).rejects.toThrow(BadRequestException);
  });

  it("accepts proposal, creates job, rejects siblings, and marks request assigned", async () => {
    const { service, proposalRepository, jobRepository, requestRepository } =
      makeService();

    const result = await service.acceptProposal("prop-1", "cust-1", "customer");

    expect(proposalRepository.acceptProposalTransaction).toHaveBeenCalledWith(
      "prop-1",
      "req-1",
      "prov-1",
      "cust-1",
    );
    expect(result).toBeDefined();
  });

  it("allows admin with proposals.manage permission to accept any proposal", async () => {
    const { service, proposalRepository } = makeService();
    await service.acceptProposal("prop-1", "admin-user", "admin", ["proposals.manage"]);
    expect(proposalRepository.acceptProposalTransaction).toHaveBeenCalled();
  });
});
