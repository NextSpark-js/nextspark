# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy full workspace config (lockfile needs all package.json references)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/studio/package.json packages/studio/
COPY apps/studio/package.json apps/studio/

# Stub out workspace packages referenced in lockfile but not needed
RUN mkdir -p packages/core packages/cli packages/create-nextspark-app packages/testing packages/ui packages/mobile packages/ai-workflow apps/dev themes/default themes/blog themes/crm themes/productivity plugins/ai plugins/langchain plugins/amplitude plugins/social-media
RUN for d in packages/core packages/cli packages/create-nextspark-app packages/testing packages/ui packages/mobile packages/ai-workflow apps/dev themes/default themes/blog themes/crm themes/productivity plugins/ai plugins/langchain plugins/amplitude plugins/social-media; do echo '{"name":"stub-'$d'","version":"0.0.0","private":true}' > "$d/package.json"; done

# Install dependencies (lockfile needs all workspace entries)
RUN pnpm install --no-frozen-lockfile

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

# Create directory for generated projects
RUN mkdir -p /app/studio-projects

EXPOSE 4000

CMD ["node", "apps/studio/server.js"]
