# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only the packages needed for the studio app
COPY packages/studio/package.json packages/studio/
COPY apps/studio/package.json apps/studio/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/studio/ packages/studio/
COPY apps/studio/ apps/studio/

# Build the studio package first (workspace dependency)
RUN pnpm --filter @nextsparkjs/studio build

# Build the Next.js app (standalone output)
RUN pnpm --filter @nextsparkjs/studio-app build

# ── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache git
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000

# Copy standalone output
COPY --from=builder /app/apps/studio/.next/standalone ./
COPY --from=builder /app/apps/studio/.next/static ./apps/studio/.next/static
COPY --from=builder /app/apps/studio/public ./apps/studio/public

# Create directory for generated projects
RUN mkdir -p /app/studio-projects

EXPOSE 4000

CMD ["node", "apps/studio/server.js"]
