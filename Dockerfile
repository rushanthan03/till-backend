# ---- Build stage ----
FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 && npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:24-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl curl \
    && rm -rf /var/lib/apt/lists/*

# Exactly the locked versions, production dependencies only.
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 && npm ci --omit=dev --no-audit --no-fund

# The compiled app lives in dist/src (the build also compiles scripts/)
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production \
    PORT=4000
EXPOSE 4000

# Never run as root inside the container.
USER node

# Orchestrators and "docker ps" use this to see whether the API is really answering.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:4000/health || exit 1

# Apply database changes first with:  docker run --rm --env-file .env <image> npm run migration:run:prod
CMD ["node", "dist/src/main"]
