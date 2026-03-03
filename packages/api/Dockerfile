FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/api/ ./packages/api/
COPY tsconfig.base.json ./

# Build shared first, then api
RUN pnpm --filter @cpro/shared build && pnpm --filter @cpro/api build

# Production stage
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/packages/shared/dist/ ./packages/shared/dist/
COPY --from=base /app/packages/api/dist/ ./packages/api/dist/

EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
