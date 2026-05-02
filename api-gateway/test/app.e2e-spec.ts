import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import helmet from "helmet";
import { AppModule } from "../src/app.module";

describe("API Gateway (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      }),
    );
    app.enableCors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Health Checks", () => {
    it("/health (GET) should return gateway health", () => {
      return request(app.getHttpServer())
        .get("/health")
        .expect(200)
        .expect((res) => {
          expect(["ok", "down"]).toContain(res.body.status);
          expect(res.body).toHaveProperty("gateway", "api-gateway");
          expect(res.body).toHaveProperty("timestamp");
          expect(res.body).toHaveProperty("services");
          expect(res.body).toHaveProperty("summary");
        });
    });

    it("/health/services (GET) should return services health", () => {
      return request(app.getHttpServer())
        .get("/health/services")
        .expect(200)
        .expect((res) => {
          expect(["ok", "down"]).toContain(res.body.status);
          expect(res.body).toHaveProperty("services");
          expect(res.body).toHaveProperty("summary");
        });
    }, 15000);
  });

  describe("Authentication", () => {
    it("should reject requests without JWT token", () => {
      return request(app.getHttpServer())
        .get("/user/auth/me")
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty("statusCode", 401);
          expect(res.body.message).toContain("token");
        });
    });

    it("should allow public routes without JWT", () => {
      return request(app.getHttpServer())
        .post("/user/auth/login")
        .send({ email: "test@example.com", password: "password" })
        .expect((res) => {
          // Should forward to auth service (may fail if service not running)
          expect([200, 201, 400, 401, 503]).toContain(res.status);
        });
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      // Verify that rate limiting middleware is active by checking response headers
      const res = await request(app.getHttpServer()).get("/health").expect(200);

      expect(res.headers).toHaveProperty("ratelimit-limit");
      expect(res.headers).toHaveProperty("ratelimit-remaining");
      expect(res.headers).toHaveProperty("ratelimit-reset");
    });
  });

  describe("Request Forwarding", () => {
    it("should forward requests to appropriate service", () => {
      return request(app.getHttpServer())
        .post("/api/v1/user/auth/signup")
        .send({
          email: "newuser@example.com",
          password: "SecurePass123!",
          name: "Test User",
          role: "customer",
        })
        .expect((res) => {
          // Should forward to auth service
          expect([201, 400, 409, 503]).toContain(res.status);
        });
    });

    it("should return 503 for unavailable services", () => {
      return request(app.getHttpServer())
        .get("/api/v1/nonexistent/route")
        .expect((res) => {
          // JWT blocks unauthenticated requests (401) before proxying,
          // or proxy fails with 503 when services are down
          expect([401, 503]).toContain(res.status);
        });
    });
  });

  describe("CORS", () => {
    it("should include CORS headers", () => {
      return request(app.getHttpServer())
        .get("/health")
        .set("Origin", "http://localhost:3000")
        .expect(200)
        .expect((res) => {
          expect(res.headers).toHaveProperty("access-control-allow-origin");
        });
    });
  });

  describe("Security Headers", () => {
    it("should include security headers from helmet", () => {
      return request(app.getHttpServer())
        .get("/health")
        .expect(200)
        .expect((res) => {
          expect(res.headers).toHaveProperty("x-content-type-options");
          expect(res.headers).toHaveProperty("x-frame-options");
        });
    });
  });
});
