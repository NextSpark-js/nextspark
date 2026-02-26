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

# Copy real core templates (needed for direct project generation at runtime)
COPY packages/core/templates /app/packages/core/templates
# The app/ directory is gitignored (synced at pack time from apps/dev/app/)
# Copy it directly from the source of truth, excluding dev-only files
COPY apps/dev/app /app/packages/core/templates/app
RUN rm -rf /app/packages/core/templates/app/'(templates)'

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

RUN apk add --no-cache git su-exec
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN npm install -g pm2

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000

# Copy standalone output
COPY --from=builder /app/apps/studio/.next/standalone ./
COPY --from=builder /app/apps/studio/.next/static ./apps/studio/.next/static

# Copy migrations (needed at runtime for auto-migration)
COPY --from=builder /app/apps/studio/migrations ./apps/studio/migrations

# Copy templates for direct project generation (replaces npx create-nextspark-app)
COPY --from=builder /app/packages/core/templates /app/templates

# Copy Claude Agent SDK CLI (needed at runtime — Next.js standalone doesn't trace child-process binaries)
COPY --from=builder /app/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.2.42_zod@3.25.76/node_modules/@anthropic-ai/claude-agent-sdk /app/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.2.42_zod@3.25.76/node_modules/@anthropic-ai/claude-agent-sdk

# Create non-root user (Agent SDK refuses bypassPermissions as root)
RUN addgroup -S studio && adduser -S studio -G studio

# Create directory for generated projects
RUN mkdir -p /app/studio-projects && chown -R studio:studio /app

# Copy entrypoint (handles volume permissions + drops to studio user)
COPY apps/studio/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 4000
EXPOSE 5100-5999
EXPOSE 6000-6999

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/studio/server.js"]
