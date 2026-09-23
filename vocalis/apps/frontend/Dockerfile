FROM node:20-alpine AS base

WORKDIR /app

# Copy package descriptors
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared-types ./packages/shared-types
COPY apps/frontend ./apps/frontend

# Build shared-types and frontend
RUN npm run build -w @meeting-assistant/shared-types
RUN npm run build -w @meeting-assistant/frontend

EXPOSE 5173

CMD ["npm", "run", "dev", "-w", "@meeting-assistant/frontend", "--", "--host"]
