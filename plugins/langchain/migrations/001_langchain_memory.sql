-- Migration: 001_langchain_memory.sql
-- Description: LangChain conversation memory persistence with multi-conversation support
-- Date: 2025-12-20

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public."langchain_sessions" (
  -- Primary key
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational fields (multi-tenancy)
  "userId"     TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"     TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "sessionId"  TEXT NOT NULL,

  -- Conversation fields
  name         TEXT DEFAULT NULL,
  "isPinned"   BOOLEAN NOT NULL DEFAULT false,

  -- Memory fields
  messages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata     JSONB DEFAULT '{}'::jsonb,
  "maxMessages" INTEGER NOT NULL DEFAULT 50,
  "expiresAt"   TIMESTAMPTZ DEFAULT NULL,

  -- System fields
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint for multi-tenant session lookup
  CONSTRAINT langchain_sessions_unique_session UNIQUE ("userId", "teamId", "sessionId")
);

-- ============================================
-- COMMENTS (Documentation)
-- ============================================
COMMENT ON TABLE  public."langchain_sessions"               IS 'LangChain conversation memory persistence with multi-conversation support';
COMMENT ON COLUMN public."langchain_sessions".id            IS 'Unique row identifier';
COMMENT ON COLUMN public."langchain_sessions"."userId"      IS 'Owner user ID';
COMMENT ON COLUMN public."langchain_sessions"."teamId"      IS 'Team context for multi-tenancy';
COMMENT ON COLUMN public."langchain_sessions"."sessionId"   IS 'Application-level session identifier (format: {userId}-{timestamp})';
COMMENT ON COLUMN public."langchain_sessions".name          IS 'User-friendly conversation name (auto-generated from first message if not set)';
COMMENT ON COLUMN public."langchain_sessions"."isPinned"    IS 'Whether this conversation is pinned to top of list';
COMMENT ON COLUMN public."langchain_sessions".messages      IS 'Serialized LangChain BaseMessage array';
COMMENT ON COLUMN public."langchain_sessions".metadata      IS 'Optional session metadata (agent type, etc)';
COMMENT ON COLUMN public."langchain_sessions"."maxMessages" IS 'Sliding window limit for this session (default: 50)';
COMMENT ON COLUMN public."langchain_sessions"."expiresAt"   IS 'TTL expiration timestamp (NULL = no expiration)';
COMMENT ON COLUMN public."langchain_sessions"."createdAt"   IS 'Row creation timestamp';
COMMENT ON COLUMN public."langchain_sessions"."updatedAt"   IS 'Last update timestamp';

-- ============================================
-- TRIGGER updatedAt
-- ============================================
DROP TRIGGER IF EXISTS langchain_sessions_set_updated_at ON public."langchain_sessions";
CREATE TRIGGER langchain_sessions_set_updated_at
BEFORE UPDATE ON public."langchain_sessions"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_langchain_sessions_user_id      ON public."langchain_sessions"("userId");
CREATE INDEX IF NOT EXISTS idx_langchain_sessions_team_id      ON public."langchain_sessions"("teamId");
CREATE INDEX IF NOT EXISTS idx_langchain_sessions_session_id   ON public."langchain_sessions"("sessionId");
CREATE INDEX IF NOT EXISTS idx_langchain_sessions_lookup       ON public."langchain_sessions"("userId", "teamId", "sessionId");
CREATE INDEX IF NOT EXISTS idx_langchain_sessions_expires_at   ON public."langchain_sessions"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_langchain_sessions_pinned       ON public."langchain_sessions"("userId", "teamId", "isPinned");
CREATE INDEX IF NOT EXISTS idx_langchain_sessions_updated      ON public."langchain_sessions"("userId", "teamId", "updatedAt" DESC);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE public."langchain_sessions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langchain_sessions_owner_policy" ON public."langchain_sessions";

-- Owner can perform all operations on their own sessions
CREATE POLICY "langchain_sessions_owner_policy"
ON public."langchain_sessions"
FOR ALL TO authenticated
USING ("userId" = public.get_auth_user_id())
WITH CHECK ("userId" = public.get_auth_user_id());
