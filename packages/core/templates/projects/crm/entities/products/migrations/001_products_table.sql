-- ============================================================================
-- Products Table Migration
-- CRM theme: Products and services catalog
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('product', 'service', 'subscription');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE product_unit AS ENUM ('piece', 'hour', 'day', 'month', 'year', 'user', 'license');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "products" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Product info
  "code" VARCHAR(50),
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100),
  "type" product_type DEFAULT 'product',
  "description" TEXT,

  -- Pricing
  "price" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cost" DECIMAL(15,2) DEFAULT 0,
  "currency" VARCHAR(3) DEFAULT 'USD',
  "unit" product_unit DEFAULT 'piece',
  
  -- Status
  "isActive" BOOLEAN DEFAULT true,
  
  -- Media
  "image" VARCHAR(500),
  "brochureUrl" VARCHAR(500),
  
  -- Sales config
  "minimumQuantity" INTEGER DEFAULT 1,
  "commissionRate" DECIMAL(5,2) DEFAULT 0,
  
  -- Ownership
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  
  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS "products_teamId_idx" ON "products" ("teamId");
CREATE INDEX IF NOT EXISTS "products_userId_idx" ON "products" ("userId");
CREATE INDEX IF NOT EXISTS "products_code_idx" ON "products" ("code");
CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products" ("name");
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category");
CREATE INDEX IF NOT EXISTS "products_type_idx" ON "products" ("type");
CREATE INDEX IF NOT EXISTS "products_isActive_idx" ON "products" ("isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "products_price_idx" ON "products" ("price");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_policy" ON "products";
DROP POLICY IF EXISTS "products_insert_policy" ON "products";
DROP POLICY IF EXISTS "products_update_policy" ON "products";
DROP POLICY IF EXISTS "products_delete_policy" ON "products";

CREATE POLICY "products_select_policy" ON "products"
  FOR SELECT
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "products_insert_policy" ON "products"
  FOR INSERT
  WITH CHECK ("teamId" = ANY(public.get_user_team_ids()));

CREATE POLICY "products_update_policy" ON "products"
  FOR UPDATE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "products_delete_policy" ON "products"
  FOR DELETE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at_trigger ON "products";
CREATE TRIGGER products_updated_at_trigger
  BEFORE UPDATE ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

COMMENT ON TABLE "products" IS 'Products and services catalog';
COMMENT ON COLUMN "products"."commissionRate" IS 'Sales commission percentage';
