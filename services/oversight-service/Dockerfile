# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm (must match packageManager in root package.json, which pnpm self-manages against)
RUN for i in 1 2 3 4 5; do npm install -g pnpm@11.9.0 && break || sleep 2; done

# Copy workspace manifests (root context lets pnpm see the whole monorepo lockfile)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY api-gateway/package.json ./api-gateway/
COPY database/package.json ./database/
COPY frontend/package.json ./frontend/
COPY services/comms-service/package.json ./services/comms-service/
COPY services/identity-service/package.json ./services/identity-service/
COPY services/infrastructure-service/package.json ./services/infrastructure-service/
COPY services/marketplace-service/package.json ./services/marketplace-service/
COPY services/oversight-service/package.json ./services/oversight-service/
COPY services/payment-service/package.json ./services/payment-service/

# Install dependencies for this service only (from the shared workspace lockfile)
# Network retry/timeout settings live in pnpm-workspace.yaml (copied above)
RUN pnpm install --frozen-lockfile --filter oversight-service...

# Copy source code for this service
COPY services/oversight-service ./services/oversight-service

# Build application
RUN pnpm --filter oversight-service run build

# Produce a self-contained node_modules bundle
RUN pnpm --filter oversight-service deploy --prod --legacy /out

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copy the self-contained node_modules from the deploy bundle
COPY --from=builder /out/node_modules ./node_modules
# dist is gitignored, so pnpm deploy's packlist skips it — copy straight from the build stage
COPY --from=builder /app/services/oversight-service/dist ./dist

RUN mkdir -p logs

EXPOSE 3010

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3010/health || exit 1

CMD ["node", "dist/main.js"]
