# Build stage: compile the React client
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci

# Copy source and build the client
COPY client/ ./client/
COPY server/ ./server/
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/

# Install only server (production) dependencies
RUN npm ci --workspace=server --omit=dev

# Copy server source and the compiled client
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

# Persist uploaded images and presentation data via a named volume
VOLUME ["/app/server/data", "/app/server/uploads"]

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002

CMD ["node", "server/index.js"]
