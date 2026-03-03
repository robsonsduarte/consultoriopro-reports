FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/web/ ./packages/web/
COPY tsconfig.base.json ./

# Build shared first, then web
RUN pnpm --filter @cpro/shared build && pnpm --filter @cpro/web build

# Nginx stage
FROM nginx:alpine

COPY --from=base /app/packages/web/dist/ /usr/share/nginx/html/
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
