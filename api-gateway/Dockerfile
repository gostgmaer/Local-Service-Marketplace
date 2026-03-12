# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Configure npm for slower networks
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build application
RUN npm run build

# Remove dev dependencies (only keep production deps for final image)
RUN npm prune --production

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy package files (for reference / npm scripts)
COPY package*.json ./

# Copy production node_modules from builder (avoids a second network fetch)
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Give ownership of logs directory to nestjs user
RUN chown -R nestjs:nodejs logs

USER nestjs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/src/main"]
