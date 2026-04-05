# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json pnpm-lock.yaml* ./

RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 600000

RUN sh -c "for i in 1 2 3; do npm install --legacy-peer-deps && exit 0; echo 'npm install failed, retrying...'; sleep 5; done; exit 1"

COPY . .

RUN npm run build

RUN npm prune --omit=dev

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml* ./

RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 600000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p logs

EXPOSE 3007

USER node

CMD ["node", "dist/main.js"]
