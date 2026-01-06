-- Migration: 002_token_usage.sql
-- Description: Token usage tracking with cost calculation and daily aggregation
-- Date: 2025-12-22

-- ============================================
-- TABLE: Token Usage Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS public."langchain_token_usage" (
  -- Primary key
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational fields (multi-tenancy)
  "userId"        TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"        TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "sessionId"     TEXT,

  -- Model information
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,

  -- Token counts
  "inputTokens"   INTEGER NOT NULL DEFAULT 0,
  "outputTokens"  INTEGER NOT NULL DEFAULT 0,
  "totalTokens"   INTEGER NOT NULL DEFAULT 0,

  -- Cost (USD, 6 decimal precision)
  "inputCost"     DECIMAL(12, 6) NOT NULL DEFAULT 0,
  "outputCost"    DECIMAL(12, 6) NOT NULL DEFAULT 0,
  "totalCost"     DECIMAL(12, 6) NOT NULL DEFAULT 0,

  -- Metadata
  "agentName"     TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,

  -- System fields
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- COMMENTS (Documentation)
-- ============================================
COMMENT ON TABLE  public."langchain_token_usage"               IS 'Token usage tracking for LangChain agents with cost calculation';
COMMENT ON COLUMN public."langchain_token_usage".id            IS 'Unique row identifier';
COMMENT ON COLUMN public."langchain_token_usage"."userId"      IS 'User who triggered the AI request';
COMMENT ON COLUMN public."langchain_token_usage"."teamId"      IS 'Team context for multi-tenancy';
COMMENT ON COLUMN public."langchain_token_usage"."sessionId"   IS 'Optional link to langchain_sessions table';
COMMENT ON COLUMN public."langchain_token_usage".provider      IS 'Model provider (openai, anthropic, ollama)';
COMMENT ON COLUMN public."langchain_token_usage".model         IS 'Specific model used (gpt-4o, claude-3-5-sonnet, etc)';
COMMENT ON COLUMN public."langchain_token_usage"."inputTokens" IS 'Number of input/prompt tokens consumed';
COMMENT ON COLUMN public."langchain_token_usage"."outputTokens" IS 'Number of output/completion tokens generated';
COMMENT ON COLUMN public."langchain_token_usage"."totalTokens" IS 'Total tokens (input + output)';
COMMENT ON COLUMN public."langchain_token_usage"."inputCost"   IS 'Cost for input tokens in USD';
COMMENT ON COLUMN public."langchain_token_usage"."outputCost"  IS 'Cost for output tokens in USD';
COMMENT ON COLUMN public."langchain_token_usage"."totalCost"   IS 'Total cost in USD';
COMMENT ON COLUMN public."langchain_token_usage"."agentName"   IS 'Name of the agent that was used';
COMMENT ON COLUMN public."langchain_token_usage".metadata      IS 'Additional metadata (tools used, execution time, etc)';
COMMENT ON COLUMN public."langchain_token_usage"."createdAt"   IS 'Timestamp when the usage was recorded';

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_token_usage_user_team          ON public."langchain_token_usage"("userId", "teamId");
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at         ON public."langchain_token_usage"("createdAt");
CREATE INDEX IF NOT EXISTS idx_token_usage_session_id         ON public."langchain_token_usage"("sessionId") WHERE "sessionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_usage_provider_model     ON public."langchain_token_usage"(provider, model);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_created_at    ON public."langchain_token_usage"("userId", "createdAt" DESC);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE public."langchain_token_usage" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langchain_token_usage_owner_select" ON public."langchain_token_usage";
DROP POLICY IF EXISTS "langchain_token_usage_owner_insert" ON public."langchain_token_usage";

-- Users can view their own usage
CREATE POLICY "langchain_token_usage_owner_select"
ON public."langchain_token_usage"
FOR SELECT TO authenticated
USING ("userId" = public.get_auth_user_id());

-- Users can insert their own usage records
CREATE POLICY "langchain_token_usage_owner_insert"
ON public."langchain_token_usage"
FOR INSERT TO authenticated
WITH CHECK ("userId" = public.get_auth_user_id());

-- ============================================
-- MATERIALIZED VIEW: Daily Aggregation
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public."langchain_usage_daily" AS
SELECT
  "userId",
  "teamId",
  provider,
  model,
  DATE("createdAt") as date,
  SUM("inputTokens")::bigint as "inputTokens",
  SUM("outputTokens")::bigint as "outputTokens",
  SUM("totalTokens")::bigint as "totalTokens",
  SUM("totalCost")::numeric(12, 6) as "totalCost",
  COUNT(*)::bigint as "requestCount"
FROM public."langchain_token_usage"
GROUP BY "userId", "teamId", provider, model, DATE("createdAt");

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_daily_unique
ON public."langchain_usage_daily"("userId", "teamId", provider, model, date);

-- Comment on materialized view
COMMENT ON MATERIALIZED VIEW public."langchain_usage_daily" IS 'Daily aggregated token usage for dashboard performance';

-- ============================================
-- FUNCTION: Refresh Materialized View
-- ============================================
CREATE OR REPLACE FUNCTION public.refresh_langchain_usage_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."langchain_usage_daily";
END;
$$;

COMMENT ON FUNCTION public.refresh_langchain_usage_daily() IS 'Refresh the daily usage materialized view (call periodically via cron)';
