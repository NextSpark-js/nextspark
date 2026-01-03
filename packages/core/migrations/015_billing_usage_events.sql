-- Migration: 20251220_004_billing_usage_events.sql
-- Description: Billing Usage Events Detail (table, indexes, RLS)
-- Date: 2025-12-20
-- Purpose: Per-user audit trail and detailed reporting

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."usage_events" CASCADE;

CREATE TABLE IF NOT EXISTS public."usage_events" (
  -- Primary Key
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys
  "subscriptionId"      TEXT NOT NULL REFERENCES public."subscriptions"(id) ON DELETE CASCADE,
  "userId"              TEXT REFERENCES public."users"(id) ON DELETE SET NULL,
  "teamId"              TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- What was consumed
  "limitSlug"           TEXT NOT NULL,
  delta                 INTEGER NOT NULL, -- +1, -1, +100, etc. (can be positive or negative)

  -- Context
  action                TEXT,          -- 'create_project', 'upload_file', 'api_call'
  "resourceType"        TEXT,          -- 'project', 'file', 'api_request'
  "resourceId"          TEXT,          -- ID of the created/modified resource

  -- Period
  "periodKey"           TEXT NOT NULL,

  -- Metadata
  metadata              JSONB DEFAULT '{}'::jsonb,

  -- Timestamp (immutable, only createdAt)
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."usage_events"                  IS 'Detailed per-user usage events for audit and reporting';
COMMENT ON COLUMN public."usage_events"."subscriptionId" IS 'Reference to subscription';
COMMENT ON COLUMN public."usage_events"."userId"         IS 'User who consumed the resource (nullable for system events)';
COMMENT ON COLUMN public."usage_events"."teamId"         IS 'Team this usage belongs to';
COMMENT ON COLUMN public."usage_events"."limitSlug"      IS 'Limit identifier being consumed';
COMMENT ON COLUMN public."usage_events".delta            IS 'Usage delta (+1 for create, -1 for delete, +N for batch)';
COMMENT ON COLUMN public."usage_events".action           IS 'Action that triggered usage (e.g., create_project, upload_file)';
COMMENT ON COLUMN public."usage_events"."resourceType"   IS 'Type of resource (e.g., project, file, api_request)';
COMMENT ON COLUMN public."usage_events"."resourceId"     IS 'ID of the resource created/modified';
COMMENT ON COLUMN public."usage_events"."periodKey"      IS 'Period key matching usage aggregates';

-- ============================================
-- INDEXES
-- ============================================
-- Indexes for reporting and audit
CREATE INDEX IF NOT EXISTS idx_usage_events_subscription_id  ON public."usage_events"("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id          ON public."usage_events"("userId") WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_events_team_id          ON public."usage_events"("teamId");
CREATE INDEX IF NOT EXISTS idx_usage_events_period_key       ON public."usage_events"("periodKey");
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at       ON public."usage_events"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_limit_slug       ON public."usage_events"("limitSlug");
CREATE INDEX IF NOT EXISTS idx_usage_events_action           ON public."usage_events"(action) WHERE action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_events_resource         ON public."usage_events"("resourceType", "resourceId") WHERE "resourceType" IS NOT NULL;

-- Composite indexes for common reporting queries
CREATE INDEX IF NOT EXISTS idx_usage_events_user_period
ON public."usage_events"("userId", "periodKey", "limitSlug");

CREATE INDEX IF NOT EXISTS idx_usage_events_team_period
ON public."usage_events"("teamId", "periodKey", "limitSlug");

CREATE INDEX IF NOT EXISTS idx_usage_events_subscription_period
ON public."usage_events"("subscriptionId", "periodKey", "limitSlug");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."usage_events" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Usage events read via team"      ON public."usage_events";
DROP POLICY IF EXISTS "Usage events system write"       ON public."usage_events";

-- Team members can read usage events via their team membership
CREATE POLICY "Usage events read via team"
ON public."usage_events"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."team_members" tm
    WHERE tm."teamId" = "usage_events"."teamId"
      AND tm."userId" = public.get_auth_user_id()
  )
);

-- System can write usage events (via trackUsage function)
CREATE POLICY "Usage events system write"
ON public."usage_events"
FOR INSERT TO authenticated
WITH CHECK (true);
