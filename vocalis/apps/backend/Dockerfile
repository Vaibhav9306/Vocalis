FROM node:20-alpine AS base

WORKDIR /app

# Copy root workspace configurations
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN npm install

# Copy source files
COPY packages/shared-types ./packages/shared-types
COPY apps/backend ./apps/backend

# Build shared-types and backend
RUN npm run build -w @meeting-assistant/shared-types
RUN npm run build -w @meeting-assistant/backend

EXPOSE 3001

CMD ["node", "apps/backend/dist/server.js"]
