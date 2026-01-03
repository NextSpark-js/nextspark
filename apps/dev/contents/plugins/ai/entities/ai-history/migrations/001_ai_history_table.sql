-- =============================================
-- AI HISTORY ENTITY MIGRATION - PLUGIN ENTITY
-- Plugin: AI
-- Entity: ai-history
-- Generic AI interaction history for all plugins
-- Date: 2025-10-03
-- =============================================

-- =============================================
-- MAIN AI_HISTORY TABLE
-- =============================================

DROP TABLE IF EXISTS "ai_history" CASCADE;

CREATE TABLE "ai_history" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,

  -- Generic polymorphic relationship (flexible for any future use case)
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,

  -- AI operation details
  operation TEXT NOT NULL CHECK (operation IN ('generate', 'refine', 'analyze', 'chat', 'completion', 'other')),
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',

  -- Metrics and cost tracking
  "tokensUsed" INTEGER,
  "tokensInput" INTEGER, -- ✅ Input tokens (prompt) - for precise cost calculation
  "tokensOutput" INTEGER, -- ✅ Output tokens (completion) - for precise cost calculation
  "creditsUsed" INTEGER,
  "estimatedCost" DECIMAL(10, 6),
  "balanceAfter" INTEGER,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Error tracking
  "errorMessage" TEXT,

  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_ai_history_user_id ON "ai_history"("userId");
CREATE INDEX IF NOT EXISTS idx_ai_history_entity ON "ai_history"("relatedEntityType", "relatedEntityId") WHERE "relatedEntityType" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_history_status ON "ai_history"(status);
CREATE INDEX IF NOT EXISTS idx_ai_history_operation ON "ai_history"(operation);
CREATE INDEX IF NOT EXISTS idx_ai_history_model ON "ai_history"(model);
CREATE INDEX IF NOT EXISTS idx_ai_history_provider ON "ai_history"(provider);
CREATE INDEX IF NOT EXISTS idx_ai_history_created_at ON "ai_history"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_ai_history_user_status ON "ai_history"("userId", status);
CREATE INDEX IF NOT EXISTS idx_ai_history_user_operation ON "ai_history"("userId", operation);
CREATE INDEX IF NOT EXISTS idx_ai_history_tokens_input ON "ai_history"("tokensInput") WHERE "tokensInput" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_history_tokens_output ON "ai_history"("tokensOutput") WHERE "tokensOutput" IS NOT NULL;

-- =============================================
-- ROW LEVEL SECURITY (enableRLS: true)
-- =============================================

-- Enable RLS
ALTER TABLE "ai_history" ENABLE ROW LEVEL SECURITY;

-- Policies for ai_history table
DROP POLICY IF EXISTS "Users can view own ai history" ON "ai_history";
CREATE POLICY "Users can view own ai history" ON "ai_history"
  FOR SELECT USING ("userId" = public.get_auth_user_id());

DROP POLICY IF EXISTS "Users can insert own ai history" ON "ai_history";
CREATE POLICY "Users can insert own ai history" ON "ai_history"
  FOR INSERT WITH CHECK ("userId" = public.get_auth_user_id());

DROP POLICY IF EXISTS "Users can update own ai history" ON "ai_history";
CREATE POLICY "Users can update own ai history" ON "ai_history"
  FOR UPDATE USING ("userId" = public.get_auth_user_id())
  WITH CHECK ("userId" = public.get_auth_user_id());

DROP POLICY IF EXISTS "Users can delete own ai history" ON "ai_history";
CREATE POLICY "Users can delete own ai history" ON "ai_history"
  FOR DELETE USING ("userId" = public.get_auth_user_id());

-- Admins can manage all ai history
DROP POLICY IF EXISTS "Admins can manage all ai history" ON "ai_history";
CREATE POLICY "Admins can manage all ai history" ON "ai_history"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE id = public.get_auth_user_id()
        AND role IN ('admin','superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE id = public.get_auth_user_id()
        AND role IN ('admin','superadmin')
    )
  );

-- =============================================
-- TRIGGER: Auto-update completedAt
-- =============================================
CREATE OR REPLACE FUNCTION update_ai_history_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW."completedAt" = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_history_completed_at
  BEFORE UPDATE ON "ai_history"
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_history_completed_at();

-- =============================================
-- CONSTRAINT: Token Split Validation
-- =============================================
-- Ensures data integrity: tokensUsed = tokensInput + tokensOutput when both present
ALTER TABLE "ai_history"
ADD CONSTRAINT chk_tokens_sum
CHECK (
  ("tokensInput" IS NULL AND "tokensOutput" IS NULL)
  OR
  ("tokensUsed" = "tokensInput" + "tokensOutput")
);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE "ai_history" IS 'Generic audit trail for AI interactions with cost and performance metrics';
COMMENT ON COLUMN "ai_history"."userId" IS 'User who initiated the AI operation';
COMMENT ON COLUMN "ai_history"."relatedEntityType" IS 'Type of entity this operation relates to (e.g., ''contents'', ''products'', ''campaigns'')';
COMMENT ON COLUMN "ai_history"."relatedEntityId" IS 'ID of the related entity (polymorphic relationship)';
COMMENT ON COLUMN "ai_history".operation IS 'Type of AI operation: generate, refine, analyze, chat, completion, or other';
COMMENT ON COLUMN "ai_history".model IS 'AI model used (e.g., claude-3-5-sonnet-20241022, gpt-4)';
COMMENT ON COLUMN "ai_history".provider IS 'AI provider: anthropic, openai, etc.';
COMMENT ON COLUMN "ai_history".status IS 'Processing status: pending, processing, completed, or failed';
COMMENT ON COLUMN "ai_history"."tokensUsed" IS 'Total tokens consumed (input + output) - kept for backward compatibility';
COMMENT ON COLUMN "ai_history"."tokensInput" IS 'Input tokens (prompt) - for precise cost calculation with asymmetric pricing';
COMMENT ON COLUMN "ai_history"."tokensOutput" IS 'Output tokens (completion) - for precise cost calculation with asymmetric pricing';
COMMENT ON COLUMN "ai_history"."creditsUsed" IS 'Credits deducted for this operation';
COMMENT ON COLUMN "ai_history"."estimatedCost" IS 'Cost in USD based on model pricing';
COMMENT ON COLUMN "ai_history"."balanceAfter" IS 'User credit balance after this operation';
COMMENT ON COLUMN "ai_history"."errorMessage" IS 'Error message if operation failed';
COMMENT ON COLUMN "ai_history"."createdAt" IS 'When the AI operation was initiated';
COMMENT ON COLUMN "ai_history"."completedAt" IS 'When the AI operation finished (success or failure)';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'AI History entity migration completed successfully!';
  RAISE NOTICE 'Plugin: ai';
  RAISE NOTICE 'Table created: ai_history';
  RAISE NOTICE 'RLS policies enabled for user isolation';
END $$;