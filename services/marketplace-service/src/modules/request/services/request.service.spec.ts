/// <reference types="jest" />

import { RequestService } from "./request.service";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "../../../common/exceptions/http.exceptions";

describe("RequestService list validation", () => {
  const createService = () => {
    const requestRepository = {
      getRequestsPaginated: jest.fn(),
      countRequests: jest.fn(),
    } as any;

    const service = new RequestService(
      requestRepository,
      {} as any,
      {} as any,
      {} as any,
      { isCacheEnabled: jest.fn().mockReturnValue(false) } as any,
      {} as any,
      {} as any,
      { log: jest.fn(), warn: jest.fn() } as any,
      { add: jest.fn() } as any, // notificationQueue
      { invalidateEntity: jest.fn(), invalidateAll: jest.fn() } as any,
      { emit: jest.fn().mockResolvedValue(undefined) } as any,
    );

    return { service };
  };

  it("rejects min_budget > max_budget", async () => {
    const { service } = createService();
    await expect(
      service.getRequests({ min_budget: 100, max_budget: 20 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects created_from > created_to", async () => {
    const { service } = createService();
    await expect(
      service.getRequests({
        created_from: "2026-03-20",
        created_to: "2026-03-10",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects cursor with page", async () => {
    const { service } = createService();
    await expect(
      service.getRequests({ cursor: "id", page: 2 } as any),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("RequestService.createRequest", () => {
  const baseDto = {
    category_id: "cat-1",
    description: "Fix my leaking tap in the kitchen",
    budget: 500,
    user_id: "user-1",
  } as any;

  function makeService(
    overrides: {
      requestRepository?: any;
      categoryRepository?: any;
      locationRepository?: any;
      userClient?: any;
    } = {},
  ) {
    const requestRepository = overrides.requestRepository ?? {
      createRequest: jest
        .fn()
        .mockResolvedValue({ id: "req-1", ...baseDto, status: "open" }),
      getSystemSetting: jest.fn().mockResolvedValue("10"),
      countActiveRequestsByUser: jest.fn().mockResolvedValue(0),
    };
    const categoryRepository = overrides.categoryRepository ?? {
      categoryExists: jest.fn().mockResolvedValue(true),
    };
    const locationRepository = overrides.locationRepository ?? {
      createLocation: jest.fn().mockResolvedValue({ id: "loc-1" }),
    };
    const userClient = overrides.userClient ?? {
      isEnabled: jest.fn().mockReturnValue(false),
      getUserById: jest.fn(),
      getUserEmail: jest.fn().mockResolvedValue(null),
    };

    const service = new RequestService(
      requestRepository,
      categoryRepository,
      locationRepository,
      { publishEvent: jest.fn().mockResolvedValue(undefined) } as any, // kafkaService
      { isCacheEnabled: jest.fn().mockReturnValue(false) } as any, // redisService
      { sendEmail: jest.fn() } as any, // notificationClient
      userClient,
      { log: jest.fn(), warn: jest.fn() } as any,
      { add: jest.fn().mockResolvedValue(undefined) } as any, // notificationQueue
      { invalidateEntity: jest.fn(), invalidateAll: jest.fn() } as any,
      { emit: jest.fn().mockResolvedValue(undefined) } as any,
    );

    return { service, requestRepository, categoryRepository, userClient };
  }

  it("throws NotFoundException when category does not exist", async () => {
    const { service } = makeService({
      categoryRepository: {
        categoryExists: jest.fn().mockResolvedValue(false),
      },
    });
    await expect(service.createRequest({ ...baseDto })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequestException when budget is zero", async () => {
    const { service } = makeService();
    await expect(
      service.createRequest({ ...baseDto, budget: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when budget is negative", async () => {
    const { service } = makeService();
    await expect(
      service.createRequest({ ...baseDto, budget: -100 }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when anonymous user has no guest_info", async () => {
    const { service } = makeService();
    await expect(
      service.createRequest({ ...baseDto, user_id: undefined }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when guest requests are disabled for anonymous user", async () => {
    const { service } = makeService({
      requestRepository: {
        createRequest: jest.fn(),
        getSystemSetting: jest.fn().mockResolvedValue("false"),
        countActiveRequestsByUser: jest.fn(),
      },
      categoryRepository: { categoryExists: jest.fn().mockResolvedValue(true) },
    });
    await expect(
      service.createRequest({
        ...baseDto,
        user_id: undefined,
        guest_info: { email: "guest@example.com" },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws ForbiddenException when authenticated user contact is not verified", async () => {
    const { service } = makeService({
      userClient: {
        isEnabled: jest.fn().mockReturnValue(true),
        getUserById: jest.fn().mockResolvedValue({
          id: "user-1",
          email_verified: false,
          phone_verified: false,
        }),
      },
    });
    await expect(service.createRequest({ ...baseDto })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("throws BadRequestException when active request cap is exceeded", async () => {
    const { service } = makeService({
      requestRepository: {
        createRequest: jest.fn(),
        getSystemSetting: jest.fn().mockResolvedValue("5"),
        countActiveRequestsByUser: jest.fn().mockResolvedValue(5), // at cap
      },
    });
    await expect(service.createRequest({ ...baseDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates request successfully and returns response DTO", async () => {
    const { service, requestRepository } = makeService();
    const result = await service.createRequest({ ...baseDto });
    expect(requestRepository.createRequest).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe("RequestService.getRequestById", () => {
  function makeService(requestRepository: any) {
    return new RequestService(
      requestRepository,
      {} as any,
      {} as any,
      {} as any,
      { isCacheEnabled: jest.fn().mockReturnValue(false) } as any,
      {} as any,
      {} as any,
      { log: jest.fn(), warn: jest.fn() } as any,
      { add: jest.fn() } as any,
      { invalidateEntity: jest.fn(), invalidateAll: jest.fn() } as any,
      { emit: jest.fn().mockResolvedValue(undefined) } as any,
    );
  }

  it("returns request when found", async () => {
    const repo = {
      getRequestById: jest.fn().mockResolvedValue({
        id: "req-1",
        category_id: "cat-1",
        description: "Fix tap",
        budget: 500,
        status: "open",
        user_id: "user-1",
      }),
    };
    const service = makeService(repo);
    const result = await service.getRequestById("req-1");
    expect(result).toBeDefined();
  });

  it("throws NotFoundException when request does not exist", async () => {
    const repo = { getRequestById: jest.fn().mockResolvedValue(null) };
    const service = makeService(repo);
    await expect(service.getRequestById("missing")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("RequestService.updateRequest", () => {
  const existingRequest = {
    id: "req-1",
    user_id: "user-1",
    status: "open",
    category_id: "cat-1",
    budget: 500,
  };

  function makeService(
    overrides: { requestRepository?: any; categoryRepository?: any } = {},
  ) {
    const requestRepository = overrides.requestRepository ?? {
      getRequestById: jest.fn().mockResolvedValue(existingRequest),
      updateRequest: jest
        .fn()
        .mockResolvedValue({ ...existingRequest, budget: 800 }),
    };
    const categoryRepository = overrides.categoryRepository ?? {
      categoryExists: jest.fn().mockResolvedValue(true),
    };
    return new RequestService(
      requestRepository,
      categoryRepository,
      {} as any, // locationRepository
      { publishEvent: jest.fn().mockResolvedValue(undefined) } as any,
      { isCacheEnabled: jest.fn().mockReturnValue(false) } as any,
      { sendEmail: jest.fn() } as any,
      { getUserEmail: jest.fn().mockResolvedValue(null) } as any,
      { log: jest.fn(), warn: jest.fn() } as any,
      { add: jest.fn() } as any,
      { invalidateEntity: jest.fn(), invalidateAll: jest.fn() } as any,
      { emit: jest.fn().mockResolvedValue(undefined) } as any,
    );
  }

  it("throws NotFoundException when request does not exist", async () => {
    const service = makeService({
      requestRepository: {
        getRequestById: jest.fn().mockResolvedValue(null),
        updateRequest: jest.fn(),
      },
    });
    await expect(
      service.updateRequest("missing", {}, "user-1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws ForbiddenException when non-owner tries to update", async () => {
    const service = makeService();
    await expect(
      service.updateRequest("req-1", { budget: 800 } as any, "other-user"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws BadRequestException when new budget is negative", async () => {
    const service = makeService();
    await expect(
      service.updateRequest("req-1", { budget: -50 } as any, "user-1"),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws NotFoundException when new category does not exist", async () => {
    const service = makeService({
      categoryRepository: {
        categoryExists: jest.fn().mockResolvedValue(false),
      },
    });
    await expect(
      service.updateRequest(
        "req-1",
        { category_id: "bad-cat" } as any,
        "user-1",
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("updates request successfully when owner provides valid data", async () => {
    const service = makeService();
    const result = await service.updateRequest(
      "req-1",
      { budget: 800 } as any,
      "user-1",
    );
    expect(result).toBeDefined();
  });
});
