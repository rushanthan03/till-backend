# Build stage
FROM node:24-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Configure npm for better network resilience
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# Install dependencies
RUN npm install --no-audit --no-fund --network-timeout=1000000

# Copy API source code
WORKDIR /app
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:24-slim

WORKDIR /app
RUN apt update -y && apt install -y openssl
# Install production dependencies only
COPY package.json ./

# Configure npm for better network resilience
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

RUN npm install --omit=dev --no-audit --no-fund --network-timeout=1000000

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3030

# Start the application
CMD ["node", "app/dist/main.js"]