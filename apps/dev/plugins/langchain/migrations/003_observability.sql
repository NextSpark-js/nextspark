-- Migration: 003_observability.sql
-- Description: LangChain observability (traces, spans, metrics tracking)
-- Date: 2025-12-22

-- ============================================
-- TABLE: Traces (Main trace records)
-- ============================================
DROP TABLE IF EXISTS public."langchain_traces" CASCADE;

CREATE TABLE IF NOT EXISTS public."langchain_traces" (
  -- Primary key
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Unique trace identifier
  "traceId"       TEXT NOT NULL UNIQUE,

  -- Relational fields (multi-tenancy)
  "userId"        TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  "teamId"        TEXT NOT NULL REFERENCES "teams"(id) ON DELETE CASCADE,
  "sessionId"     TEXT,

  -- Agent information
  "agentName"     TEXT NOT NULL,
  "agentType"     TEXT,
  "parentId"      TEXT,

  -- Input/Output (truncatable content)
  input           TEXT,
  output          TEXT,

  -- Status and error tracking
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  error           TEXT,
  "errorType"     TEXT,
  "errorStack"    TEXT,

  -- Timing information
  "startedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endedAt"       TIMESTAMPTZ,
  "durationMs"    INTEGER,

  -- Token usage and cost
  "inputTokens"   INTEGER DEFAULT 0,
  "outputTokens"  INTEGER DEFAULT 0,
  "totalTokens"   INTEGER DEFAULT 0,
  "totalCost"     DECIMAL(12, 6) DEFAULT 0,

  -- Call counts
  "llmCalls"      INTEGER DEFAULT 0,
  "toolCalls"     INTEGER DEFAULT 0,

  -- Additional metadata
  metadata        JSONB DEFAULT '{}'::jsonb,
  tags            TEXT[],

  -- System fields
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- COMMENTS: Traces Table
-- ============================================
COMMENT ON TABLE  public."langchain_traces"                 IS 'LangChain agent invocation traces for observability';
COMMENT ON COLUMN public."langchain_traces".id              IS 'Unique row identifier';
COMMENT ON COLUMN public."langchain_traces"."traceId"       IS 'Unique trace identifier (gen by tracer)';
COMMENT ON COLUMN public."langchain_traces"."userId"        IS 'User who triggered the agent invocation';
COMMENT ON COLUMN public."langchain_traces"."teamId"        IS 'Team context for multi-tenancy';
COMMENT ON COLUMN public."langchain_traces"."sessionId"     IS 'Optional session identifier';
COMMENT ON COLUMN public."langchain_traces"."agentName"     IS 'Name of the agent that was invoked';
COMMENT ON COLUMN public."langchain_traces"."agentType"     IS 'Type/category of agent';
COMMENT ON COLUMN public."langchain_traces"."parentId"      IS 'Parent trace ID for nested agent calls';
COMMENT ON COLUMN public."langchain_traces".input           IS 'Agent input (truncated if too long)';
COMMENT ON COLUMN public."langchain_traces".output          IS 'Agent output (truncated if too long)';
COMMENT ON COLUMN public."langchain_traces".status          IS 'Trace status: running, success, error';
COMMENT ON COLUMN public."langchain_traces".error           IS 'Error message if failed';
COMMENT ON COLUMN public."langchain_traces"."errorType"     IS 'Error type/category';
COMMENT ON COLUMN public."langchain_traces"."errorStack"    IS 'Error stack trace';
COMMENT ON COLUMN public."langchain_traces"."startedAt"     IS 'Trace start timestamp';
COMMENT ON COLUMN public."langchain_traces"."endedAt"       IS 'Trace end timestamp';
COMMENT ON COLUMN public."langchain_traces"."durationMs"    IS 'Total duration in milliseconds';
COMMENT ON COLUMN public."langchain_traces"."inputTokens"   IS 'Total input tokens across all LLM calls';
COMMENT ON COLUMN public."langchain_traces"."outputTokens"  IS 'Total output tokens across all LLM calls';
COMMENT ON COLUMN public."langchain_traces"."totalTokens"   IS 'Total tokens (input + output)';
COMMENT ON COLUMN public."langchain_traces"."totalCost"     IS 'Total cost in USD';
COMMENT ON COLUMN public."langchain_traces"."llmCalls"      IS 'Number of LLM calls in trace';
COMMENT ON COLUMN public."langchain_traces"."toolCalls"     IS 'Number of tool calls in trace';
COMMENT ON COLUMN public."langchain_traces".metadata        IS 'Additional trace metadata';
COMMENT ON COLUMN public."langchain_traces".tags            IS 'Tags for filtering and categorization';
COMMENT ON COLUMN public."langchain_traces"."createdAt"     IS 'Record creation timestamp';
COMMENT ON COLUMN public."langchain_traces"."updatedAt"     IS 'Record last update timestamp';

-- ============================================
-- INDEXES: Traces Table
-- ============================================
CREATE INDEX IF NOT EXISTS idx_traces_trace_id            ON public."langchain_traces"("traceId");
CREATE INDEX IF NOT EXISTS idx_traces_user_id             ON public."langchain_traces"("userId");
CREATE INDEX IF NOT EXISTS idx_traces_team_id             ON public."langchain_traces"("teamId");
CREATE INDEX IF NOT EXISTS idx_traces_team_time           ON public."langchain_traces"("teamId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_traces_status              ON public."langchain_traces"(status) WHERE status != 'success';
CREATE INDEX IF NOT EXISTS idx_traces_agent               ON public."langchain_traces"("agentName", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_traces_parent_id           ON public."langchain_traces"("parentId") WHERE "parentId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_traces_session             ON public."langchain_traces"("sessionId") WHERE "sessionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_traces_created_at          ON public."langchain_traces"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_traces_user_created_at     ON public."langchain_traces"("userId", "createdAt" DESC);

-- ============================================
-- TRIGGER: Traces updatedAt
-- ============================================
DROP TRIGGER IF EXISTS langchain_traces_set_updated_at ON public."langchain_traces";
CREATE TRIGGER langchain_traces_set_updated_at
BEFORE UPDATE ON public."langchain_traces"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE: Spans (Individual operations)
-- ============================================
CREATE TABLE IF NOT EXISTS public."langchain_spans" (
  -- Primary key
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Unique span identifier
  "spanId"       TEXT NOT NULL UNIQUE,

  -- Relational fields
  "traceId"      TEXT NOT NULL REFERENCES public."langchain_traces"("traceId") ON DELETE CASCADE,
  "parentSpanId" TEXT,

  -- Span information
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('llm', 'tool', 'chain', 'retriever')),

  -- LLM-specific fields
  provider       TEXT,
  model          TEXT,
  "inputTokens"  INTEGER,
  "outputTokens" INTEGER,

  -- Tool-specific fields
  "toolName"     TEXT,
  "toolInput"    JSONB,
  "toolOutput"   JSONB,

  -- Generic input/output
  input          JSONB,
  output         JSONB,

  -- Status and error tracking
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  error          TEXT,

  -- Timing information
  "startedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endedAt"      TIMESTAMPTZ,
  "durationMs"   INTEGER,

  -- Hierarchy depth
  depth          INTEGER DEFAULT 0,

  -- System fields
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- COMMENTS: Spans Table
-- ============================================
COMMENT ON TABLE  public."langchain_spans"               IS 'Individual operations (spans) within LangChain traces';
COMMENT ON COLUMN public."langchain_spans".id            IS 'Unique row identifier';
COMMENT ON COLUMN public."langchain_spans"."spanId"      IS 'Unique span identifier';
COMMENT ON COLUMN public."langchain_spans"."traceId"     IS 'Parent trace identifier';
COMMENT ON COLUMN public."langchain_spans"."parentSpanId" IS 'Parent span ID for nested operations';
COMMENT ON COLUMN public."langchain_spans".name          IS 'Span name/description';
COMMENT ON COLUMN public."langchain_spans".type          IS 'Span type: llm, tool, chain, retriever';
COMMENT ON COLUMN public."langchain_spans".provider      IS 'LLM provider (openai, anthropic, etc)';
COMMENT ON COLUMN public."langchain_spans".model         IS 'LLM model name';
COMMENT ON COLUMN public."langchain_spans"."inputTokens" IS 'Input tokens (LLM spans)';
COMMENT ON COLUMN public."langchain_spans"."outputTokens" IS 'Output tokens (LLM spans)';
COMMENT ON COLUMN public."langchain_spans"."toolName"    IS 'Tool name (tool spans)';
COMMENT ON COLUMN public."langchain_spans"."toolInput"   IS 'Tool input data (tool spans)';
COMMENT ON COLUMN public."langchain_spans"."toolOutput"  IS 'Tool output data (tool spans)';
COMMENT ON COLUMN public."langchain_spans".input         IS 'Generic span input';
COMMENT ON COLUMN public."langchain_spans".output        IS 'Generic span output';
COMMENT ON COLUMN public."langchain_spans".status        IS 'Span status: running, success, error';
COMMENT ON COLUMN public."langchain_spans".error         IS 'Error message if failed';
COMMENT ON COLUMN public."langchain_spans"."startedAt"   IS 'Span start timestamp';
COMMENT ON COLUMN public."langchain_spans"."endedAt"     IS 'Span end timestamp';
COMMENT ON COLUMN public."langchain_spans"."durationMs"  IS 'Span duration in milliseconds';
COMMENT ON COLUMN public."langchain_spans".depth         IS 'Nesting depth in span tree';
COMMENT ON COLUMN public."langchain_spans"."createdAt"   IS 'Record creation timestamp';
COMMENT ON COLUMN public."langchain_spans"."updatedAt"   IS 'Record last update timestamp';

-- ============================================
-- INDEXES: Spans Table
-- ============================================
CREATE INDEX IF NOT EXISTS idx_spans_span_id          ON public."langchain_spans"("spanId");
CREATE INDEX IF NOT EXISTS idx_spans_trace_id         ON public."langchain_spans"("traceId");
CREATE INDEX IF NOT EXISTS idx_spans_trace_time       ON public."langchain_spans"("traceId", "startedAt");
CREATE INDEX IF NOT EXISTS idx_spans_parent_id        ON public."langchain_spans"("parentSpanId") WHERE "parentSpanId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spans_type             ON public."langchain_spans"(type);
CREATE INDEX IF NOT EXISTS idx_spans_provider_model   ON public."langchain_spans"(provider, model) WHERE type = 'llm';
CREATE INDEX IF NOT EXISTS idx_spans_tool_name        ON public."langchain_spans"("toolName") WHERE type = 'tool';
CREATE INDEX IF NOT EXISTS idx_spans_created_at       ON public."langchain_spans"("createdAt" DESC);

-- ============================================
-- TRIGGER: Spans updatedAt
-- ============================================
DROP TRIGGER IF EXISTS langchain_spans_set_updated_at ON public."langchain_spans";
CREATE TRIGGER langchain_spans_set_updated_at
BEFORE UPDATE ON public."langchain_spans"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS: Traces Table (Superadmin sees all)
-- ============================================
ALTER TABLE public."langchain_traces" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langchain_traces_owner_access"     ON public."langchain_traces";
DROP POLICY IF EXISTS "langchain_traces_superadmin_access" ON public."langchain_traces";

-- Users can view their own traces
CREATE POLICY "langchain_traces_owner_access"
ON public."langchain_traces"
FOR ALL TO authenticated
USING ("userId" = public.get_auth_user_id());

-- Superadmins can view all traces
CREATE POLICY "langchain_traces_superadmin_access"
ON public."langchain_traces"
FOR ALL TO authenticated
USING (public.is_superadmin());

-- ============================================
-- RLS: Spans Table (Inherit from traces)
-- ============================================
ALTER TABLE public."langchain_spans" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langchain_spans_owner_access"     ON public."langchain_spans";
DROP POLICY IF EXISTS "langchain_spans_superadmin_access" ON public."langchain_spans";

-- Users can view spans from their own traces
CREATE POLICY "langchain_spans_owner_access"
ON public."langchain_spans"
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."langchain_traces" t
    WHERE t."traceId" = "langchain_spans"."traceId"
      AND t."userId" = public.get_auth_user_id()
  )
);

-- Superadmins can view all spans
CREATE POLICY "langchain_spans_superadmin_access"
ON public."langchain_spans"
FOR ALL TO authenticated
USING (public.is_superadmin());
