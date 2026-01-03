-- ============================================================================
-- Productivity Theme - Sample Data Migration
-- Scenario: Multi-tenant workspace with multiple teams
-- Teams Mode: multi-tenant
--
-- Multi-tenant mode features:
-- - Multiple work teams (workspaces)
-- - Team switching enabled
-- - Can create new teams
-- - Invitations enabled (owner/admin can invite members)
-- ============================================================================

-- ============================================
-- STEP 0: CLEANUP (preserves superadmin)
-- ============================================
DO $$
DECLARE
  v_superadmin_id TEXT;
BEGIN
  -- Get superadmin ID to preserve
  SELECT id INTO v_superadmin_id FROM "users" WHERE role = 'superadmin' LIMIT 1;
  
  -- Clean theme entities (if tables exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cards') THEN
    TRUNCATE "cards" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lists') THEN
    TRUNCATE "lists" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'boards') THEN
    TRUNCATE "boards" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    TRUNCATE "invoices" CASCADE;
  END IF;

  -- Clean team-related data (except superadmin's)
  IF v_superadmin_id IS NOT NULL THEN
    DELETE FROM "api_audit_log" WHERE "userId" != v_superadmin_id;
    DELETE FROM "api_key" WHERE "userId" != v_superadmin_id;
    DELETE FROM "team_members" WHERE "userId" != v_superadmin_id;
    DELETE FROM "teams" WHERE "ownerId" != v_superadmin_id;
    DELETE FROM "users_metas" WHERE "userId" != v_superadmin_id;
    DELETE FROM "session" WHERE "userId" != v_superadmin_id;
    DELETE FROM "account" WHERE "userId" != v_superadmin_id;
    DELETE FROM "users" WHERE id != v_superadmin_id;
  ELSE
    DELETE FROM "api_audit_log";
    DELETE FROM "api_key";
    DELETE FROM "team_members";
    DELETE FROM "teams";
    DELETE FROM "users_metas";
    DELETE FROM "session";
    DELETE FROM "account";
    DELETE FROM "users";
  END IF;

  RAISE NOTICE 'Productivity theme cleanup complete. Superadmin preserved.';
END $$;

-- ============================================
-- STEP 1: CREATE USERS
-- ============================================
-- Multi-tenant mode: 4 users across 2 teams
-- Patricia (owner of both), Lucas (admin/member), Diana (member), Marcos (member)

INSERT INTO "users" (
  id,
  email,
  name,
  "firstName",
  "lastName",
  role,
  "emailVerified",
  language,
  country,
  timezone,
  "createdAt",
  "updatedAt"
) VALUES
  -- PM / Team Lead (owner of both teams)
  (
    'usr-prod-pm-001',
    'prod_owner_patricia@nextspark.dev',
    'Patricia Torres',
    'Patricia',
    'Torres',
    'member',
    true,
    'es',
    'ES',
    'Europe/Madrid',
    NOW(),
    NOW()
  ),
  -- Developer (admin in Product Team, member in Marketing Hub)
  (
    'usr-prod-dev-001',
    'prod_admin_member_lucas@nextspark.dev',
    'Lucas Luna',
    'Lucas',
    'Luna',
    'member',
    true,
    'es',
    'AR',
    'America/Argentina/Buenos_Aires',
    NOW(),
    NOW()
  ),
  -- Designer (member in Product Team only)
  (
    'usr-prod-design-001',
    'prod_member_diana@nextspark.dev',
    'Diana Rios',
    'Diana',
    'Rios',
    'member',
    true,
    'en',
    'US',
    'America/Los_Angeles',
    NOW(),
    NOW()
  ),
  -- Marketing (member in Marketing Hub only)
  (
    'usr-prod-mkt-001',
    'prod_member_marcos@nextspark.dev',
    'Marcos Silva',
    'Marcos',
    'Silva',
    'member',
    true,
    'es',
    'MX',
    'America/Mexico_City',
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- STEP 2: CREATE TEAMS
-- ============================================
-- Multi-tenant mode: TWO work teams
-- Product Team for development, Marketing Hub for marketing campaigns

INSERT INTO "teams" (
  id,
  name,
  slug,
  description,
  "ownerId",
  "createdAt",
  "updatedAt"
) VALUES
  -- Product Team (Patricia is owner)
  (
    'team-prod-product',
    'Product Team',
    'product-team',
    'Collaborative workspace for the product team',
    'usr-prod-pm-001',
    NOW(),
    NOW()
  ),
  -- Marketing Hub (Patricia is owner)
  (
    'team-prod-marketing',
    'Marketing Hub',
    'marketing-hub',
    'Creative workspace for marketing campaigns',
    'usr-prod-pm-001',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 3: CREATE TEAM MEMBERSHIPS
-- ============================================
-- Multi-tenant mode: Users have different roles in different teams
-- Lucas has admin in Product Team but member in Marketing Hub

INSERT INTO "team_members" (
  id,
  "teamId",
  "userId",
  role,
  "invitedBy",
  "joinedAt"
) VALUES
  -- Product Team memberships
  ('tm-prod-pm-shared-001', 'team-prod-product', 'usr-prod-pm-001', 'owner', NULL, NOW()),
  ('tm-prod-dev-shared-001', 'team-prod-product', 'usr-prod-dev-001', 'admin', 'usr-prod-pm-001', NOW()),
  ('tm-prod-design-shared-001', 'team-prod-product', 'usr-prod-design-001', 'member', 'usr-prod-pm-001', NOW()),
  -- Marketing Hub memberships
  ('tm-mkt-pm-001', 'team-prod-marketing', 'usr-prod-pm-001', 'owner', NULL, NOW()),
  ('tm-mkt-dev-001', 'team-prod-marketing', 'usr-prod-dev-001', 'member', 'usr-prod-pm-001', NOW()),
  ('tm-mkt-marcos-001', 'team-prod-marketing', 'usr-prod-mkt-001', 'member', 'usr-prod-pm-001', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 4: CREATE ACCOUNTS (Password: Test1234)
-- ============================================

INSERT INTO "account" (
  id,
  "userId",
  "accountId",
  "providerId",
  "accessToken",
  "refreshToken",
  "idToken",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
  "scope",
  "password",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'acc-prod-pm-001',
    'usr-prod-pm-001',
    'prod_owner_patricia@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(),
    NOW()
  ),
  (
    'acc-prod-dev-001',
    'usr-prod-dev-001',
    'prod_admin_member_lucas@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(),
    NOW()
  ),
  (
    'acc-prod-design-001',
    'usr-prod-design-001',
    'prod_member_diana@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(),
    NOW()
  ),
  (
    'acc-prod-mkt-001',
    'usr-prod-mkt-001',
    'prod_member_marcos@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(),
    NOW()
  )
ON CONFLICT ("providerId", "accountId") DO NOTHING;

-- ============================================
-- STEP 5: CREATE USER METADATA
-- ============================================
-- Set active team for each user

INSERT INTO "users_metas" (
  "userId",
  "metaKey",
  "metaValue",
  "dataType",
  "isPublic",
  "isSearchable",
  "createdAt",
  "updatedAt"
) VALUES
  -- PM starts in Product Team
  ('usr-prod-pm-001', 'activeTeamId', '"team-prod-product"', 'json', false, false, NOW(), NOW()),
  ('usr-prod-pm-001', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  -- Dev starts in Product Team
  ('usr-prod-dev-001', 'activeTeamId', '"team-prod-product"', 'json', false, false, NOW(), NOW()),
  ('usr-prod-dev-001', 'uiPreferences', '{"theme": "dark", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  -- Designer starts in Product Team
  ('usr-prod-design-001', 'activeTeamId', '"team-prod-product"', 'json', false, false, NOW(), NOW()),
  ('usr-prod-design-001', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  -- Marketing starts in Marketing Hub
  ('usr-prod-mkt-001', 'activeTeamId', '"team-prod-marketing"', 'json', false, false, NOW(), NOW()),
  ('usr-prod-mkt-001', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW())
ON CONFLICT ("userId", "metaKey") DO NOTHING;

-- ============================================
-- STEP 6: CREATE API KEYS
-- ============================================

INSERT INTO "api_key" (
  id,
  "userId",
  name,
  "keyHash",
  "keyPrefix",
  scopes,
  "expiresAt",
  "createdAt",
  "updatedAt",
  status
) VALUES
  (
    'apikey-prod-pm-001',
    'usr-prod-pm-001',
    'PM API Key',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    'testkey_prod001',
    ARRAY['boards:read', 'boards:write', 'boards:delete', 'lists:read', 'lists:write', 'cards:read', 'cards:write'],
    NULL,
    NOW(),
    NOW(),
    'active'
  ),
  (
    'apikey-prod-dev-001',
    'usr-prod-dev-001',
    'Dev API Key',
    'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    'testkey_prod002',
    ARRAY['boards:read', 'boards:write', 'lists:read', 'lists:write', 'cards:read', 'cards:write'],
    NULL,
    NOW(),
    NOW(),
    'active'
  ),
  (
    'apikey-prod-design-001',
    'usr-prod-design-001',
    'Designer API Key',
    'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    'testkey_prod003',
    ARRAY['boards:read', 'lists:read', 'cards:read', 'cards:write'],
    NULL,
    NOW(),
    NOW(),
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 8: CREATE INVOICES
-- ============================================
-- Pro Plan subscription: $29/month (coherent with subscriptions)
-- Product Team: 6 months history
-- Marketing Hub: 6 months history

INSERT INTO "invoices" (
  id,
  "teamId",
  "invoiceNumber",
  date,
  amount,
  currency,
  status,
  "pdfUrl",
  description
) VALUES
  -- Product Team - 6 months of subscription history ($29/month Pro Plan)
  ('inv-prod-001', 'team-prod-product', 'INV-PROD-001',
   NOW() - INTERVAL '5 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-prod-001.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-prod-002', 'team-prod-product', 'INV-PROD-002',
   NOW() - INTERVAL '4 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-prod-002.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-prod-003', 'team-prod-product', 'INV-PROD-003',
   NOW() - INTERVAL '3 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-prod-003.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-prod-004', 'team-prod-product', 'INV-PROD-004',
   NOW() - INTERVAL '2 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-prod-004.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-prod-005', 'team-prod-product', 'INV-PROD-005',
   NOW() - INTERVAL '1 month', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-prod-005.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-prod-006', 'team-prod-product', 'INV-PROD-006',
   NOW(), 29.00, 'USD', 'pending',
   NULL,
   'Pro Plan - Monthly subscription'),
  -- Marketing Hub - 6 months of subscription history ($29/month Pro Plan)
  ('inv-mkt-001', 'team-prod-marketing', 'INV-MKT-001',
   NOW() - INTERVAL '5 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-mkt-001.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-mkt-002', 'team-prod-marketing', 'INV-MKT-002',
   NOW() - INTERVAL '4 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-mkt-002.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-mkt-003', 'team-prod-marketing', 'INV-MKT-003',
   NOW() - INTERVAL '3 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-mkt-003.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-mkt-004', 'team-prod-marketing', 'INV-MKT-004',
   NOW() - INTERVAL '2 months', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-mkt-004.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-mkt-005', 'team-prod-marketing', 'INV-MKT-005',
   NOW() - INTERVAL '1 month', 29.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-mkt-005.pdf',
   'Pro Plan - Monthly subscription'),
  ('inv-mkt-006', 'team-prod-marketing', 'INV-MKT-006',
   NOW(), 29.00, 'USD', 'pending',
   NULL,
   'Pro Plan - Monthly subscription')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 9: CREATE MARKETING HUB BOARDS
-- ============================================
-- 2 boards for Marketing Hub team

INSERT INTO "boards" (
  id,
  "userId",
  "teamId",
  name,
  description,
  color,
  position,
  "createdAt",
  "updatedAt"
) VALUES
  -- Campaign Tracker board
  (
    'board-mkt-campaigns-001',
    'usr-prod-pm-001',
    'team-prod-marketing',
    'Campaign Tracker',
    'Track all marketing campaigns and their progress',
    'blue',
    100,
    NOW(),
    NOW()
  ),
  -- Content Calendar board
  (
    'board-mkt-content-001',
    'usr-prod-pm-001',
    'team-prod-marketing',
    'Content Calendar',
    'Plan and schedule content across all channels',
    'green',
    200,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 10: CREATE MARKETING HUB LISTS
-- ============================================

INSERT INTO "lists" (
  id,
  "boardId",
  "userId",
  "teamId",
  name,
  position,
  "createdAt",
  "updatedAt"
) VALUES
  -- Campaign Tracker lists
  ('list-mkt-planning-001', 'board-mkt-campaigns-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Planning', 100, NOW(), NOW()),
  ('list-mkt-inprogress-001', 'board-mkt-campaigns-001', 'usr-prod-pm-001', 'team-prod-marketing', 'In Progress', 200, NOW(), NOW()),
  ('list-mkt-completed-001', 'board-mkt-campaigns-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Completed', 300, NOW(), NOW()),
  -- Content Calendar lists
  ('list-mkt-ideas-001', 'board-mkt-content-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Ideas', 100, NOW(), NOW()),
  ('list-mkt-drafts-001', 'board-mkt-content-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Drafts', 200, NOW(), NOW()),
  ('list-mkt-published-001', 'board-mkt-content-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Published', 300, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 11: CREATE MARKETING HUB CARDS
-- ============================================

INSERT INTO "cards" (
  id,
  "listId",
  "boardId",
  "userId",
  "teamId",
  title,
  description,
  priority,
  position,
  "createdAt",
  "updatedAt"
) VALUES
  -- Campaign Tracker - Planning
  ('card-mkt-001', 'list-mkt-planning-001', 'board-mkt-campaigns-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Q4 Social Media Campaign', 'Plan holiday social media strategy across all platforms', 'high', 100, NOW(), NOW()),
  ('card-mkt-002', 'list-mkt-planning-001', 'board-mkt-campaigns-001', 'usr-prod-mkt-001', 'team-prod-marketing', 'Influencer Partnerships', 'Research and reach out to potential influencers', 'medium', 200, NOW(), NOW()),
  -- Campaign Tracker - In Progress
  ('card-mkt-003', 'list-mkt-inprogress-001', 'board-mkt-campaigns-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Holiday Email Sequence', 'Create 5-email sequence for holiday promotions', 'high', 100, NOW(), NOW()),
  ('card-mkt-004', 'list-mkt-inprogress-001', 'board-mkt-campaigns-001', 'usr-prod-dev-001', 'team-prod-marketing', 'Product Launch Video', 'Edit and finalize product demo video', 'medium', 200, NOW(), NOW()),
  -- Campaign Tracker - Completed
  ('card-mkt-005', 'list-mkt-completed-001', 'board-mkt-campaigns-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Brand Refresh Assets', 'Update all brand assets with new guidelines', 'low', 100, NOW(), NOW()),
  -- Content Calendar - Ideas
  ('card-mkt-006', 'list-mkt-ideas-001', 'board-mkt-content-001', 'usr-prod-mkt-001', 'team-prod-marketing', 'Blog: 2024 Trends Analysis', 'Write comprehensive analysis of industry trends', 'medium', 100, NOW(), NOW()),
  ('card-mkt-007', 'list-mkt-ideas-001', 'board-mkt-content-001', 'usr-prod-dev-001', 'team-prod-marketing', 'YouTube Tutorial Series', 'Create 5-part tutorial series for new users', 'low', 200, NOW(), NOW()),
  -- Content Calendar - Drafts
  ('card-mkt-008', 'list-mkt-drafts-001', 'board-mkt-content-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Twitter Thread: Product Features', 'Draft thread showcasing key features', 'medium', 100, NOW(), NOW()),
  ('card-mkt-009', 'list-mkt-drafts-001', 'board-mkt-content-001', 'usr-prod-mkt-001', 'team-prod-marketing', 'Newsletter: Monthly Digest', 'Compile top stories for monthly newsletter', 'high', 200, NOW(), NOW()),
  -- Content Calendar - Published
  ('card-mkt-010', 'list-mkt-published-001', 'board-mkt-content-001', 'usr-prod-pm-001', 'team-prod-marketing', 'Case Study: Client Success', 'Published case study with Enterprise client', 'medium', 100, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 12: SUBSCRIPTIONS (B2B multi-tenant - without userId)
-- ============================================
-- Note: Productivity theme is multi-tenant B2B - NO userId
-- Each team has its own subscription
-- IMPORTANT: Delete trigger-created free subscriptions before explicit INSERT

DELETE FROM public."subscriptions" WHERE "teamId" IN (
  'team-prod-product', 'team-prod-marketing'
);

INSERT INTO public."subscriptions" (
  id, "teamId", "planId", status,
  "currentPeriodStart", "currentPeriodEnd", "billingInterval", "paymentProvider",
  "externalSubscriptionId", "externalCustomerId", "createdAt"
) VALUES
  -- Product Team → Pro Plan $29/mo (active, monthly)
  ('sub-prod-product', 'team-prod-product', 'plan_pro', 'active',
   NOW() - INTERVAL '20 days', NOW() + INTERVAL '10 days', 'monthly', 'stripe',
   'sub_stripe_product', 'cus_product', NOW() - INTERVAL '6 months'),
  -- Marketing Hub → Pro Plan $29/mo (active, monthly)
  ('sub-prod-marketing', 'team-prod-marketing', 'plan_pro', 'active',
   NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 'monthly', 'stripe',
   'sub_stripe_marketing', 'cus_marketing', NOW() - INTERVAL '6 months')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 13: BILLING EVENTS
-- ============================================

INSERT INTO public."billing_events" (id, "subscriptionId", type, status, amount, currency, "createdAt")
VALUES
  -- Product Team (6 meses @ $29)
  ('be-prod-001', 'sub-prod-product', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '6 months'),
  ('be-prod-002', 'sub-prod-product', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-prod-003', 'sub-prod-product', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-prod-004', 'sub-prod-product', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-prod-005', 'sub-prod-product', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-prod-006', 'sub-prod-product', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '1 month'),
  -- Marketing Hub (6 meses @ $29)
  ('be-mkt-001', 'sub-prod-marketing', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '6 months'),
  ('be-mkt-002', 'sub-prod-marketing', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-mkt-003', 'sub-prod-marketing', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-mkt-004', 'sub-prod-marketing', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-mkt-005', 'sub-prod-marketing', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-mkt-006', 'sub-prod-marketing', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 14: TEAM METADATA (multi-tenant workspace attributes)
-- ============================================

UPDATE public."teams" SET metadata = '{"workspaceType": "development", "boardCount": 0, "memberCount": 3}'::jsonb WHERE id = 'team-prod-product';
UPDATE public."teams" SET metadata = '{"workspaceType": "marketing", "boardCount": 2, "memberCount": 3}'::jsonb WHERE id = 'team-prod-marketing';

-- ============================================
-- STEP 15: 10 ADDITIONAL TEAMS (Multi-tenant B2B)
-- ============================================
-- Diverse scenarios: monthly/yearly, active/canceled/past_due/trialing/free
-- Each team has owner + 2-3 members

-- USERS for 10 new teams (30 users total: 10 owners + 20 members)
INSERT INTO "users" (
  id, email, name, "firstName", "lastName", role,
  "emailVerified", language, country, timezone, "createdAt", "updatedAt"
) VALUES
  -- Team 3: Lambda Labs (Enterprise, yearly, active)
  ('usr-lambda-owner', 'lambda.owner@nextspark.dev', 'Sofia Lambda', 'Sofia', 'Lambda', 'member', true, 'en', 'US', 'America/New_York', NOW(), NOW()),
  ('usr-lambda-admin', 'lambda.admin@nextspark.dev', 'Carlos Lambda', 'Carlos', 'Admin', 'member', true, 'en', 'US', 'America/New_York', NOW(), NOW()),
  ('usr-lambda-member', 'lambda.member@nextspark.dev', 'Ana Lambda', 'Ana', 'Member', 'member', true, 'en', 'US', 'America/New_York', NOW(), NOW()),

  -- Team 4: Mu Ventures (Enterprise, yearly, active)
  ('usr-mu-owner', 'mu.owner@nextspark.dev', 'Diego Mu', 'Diego', 'Mu', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW(), NOW()),
  ('usr-mu-admin', 'mu.admin@nextspark.dev', 'Elena Mu', 'Elena', 'Admin', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW(), NOW()),
  ('usr-mu-member', 'mu.member@nextspark.dev', 'Felix Mu', 'Felix', 'Member', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW(), NOW()),

  -- Team 5: Nu Digital (Pro, yearly, active)
  ('usr-nu-owner', 'nu.owner@nextspark.dev', 'Gabriel Nu', 'Gabriel', 'Nu', 'member', true, 'en', 'GB', 'Europe/London', NOW(), NOW()),
  ('usr-nu-admin', 'nu.admin@nextspark.dev', 'Helena Nu', 'Helena', 'Admin', 'member', true, 'en', 'GB', 'Europe/London', NOW(), NOW()),
  ('usr-nu-member', 'nu.member@nextspark.dev', 'Ivan Nu', 'Ivan', 'Member', 'member', true, 'en', 'GB', 'Europe/London', NOW(), NOW()),

  -- Team 6: Xi Consulting (Pro, monthly, active)
  ('usr-xi-owner', 'xi.owner@nextspark.dev', 'Julia Xi', 'Julia', 'Xi', 'member', true, 'en', 'US', 'America/Chicago', NOW(), NOW()),
  ('usr-xi-admin', 'xi.admin@nextspark.dev', 'Kevin Xi', 'Kevin', 'Admin', 'member', true, 'en', 'US', 'America/Chicago', NOW(), NOW()),
  ('usr-xi-member', 'xi.member@nextspark.dev', 'Laura Xi', 'Laura', 'Member', 'member', true, 'en', 'US', 'America/Chicago', NOW(), NOW()),

  -- Team 7: Omicron Tech (Pro, monthly, trialing)
  ('usr-omicron-owner', 'omicron.owner@nextspark.dev', 'Miguel Omicron', 'Miguel', 'Omicron', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW(), NOW()),
  ('usr-omicron-admin', 'omicron.admin@nextspark.dev', 'Natalia Omicron', 'Natalia', 'Admin', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW(), NOW()),
  ('usr-omicron-member', 'omicron.member@nextspark.dev', 'Oscar Omicron', 'Oscar', 'Member', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW(), NOW()),

  -- Team 8: Pi Systems (Pro, monthly, past_due)
  ('usr-pi-owner', 'pi.owner@nextspark.dev', 'Paula Pi', 'Paula', 'Pi', 'member', true, 'en', 'AU', 'Australia/Sydney', NOW(), NOW()),
  ('usr-pi-admin', 'pi.admin@nextspark.dev', 'Quentin Pi', 'Quentin', 'Admin', 'member', true, 'en', 'AU', 'Australia/Sydney', NOW(), NOW()),
  ('usr-pi-member', 'pi.member@nextspark.dev', 'Rosa Pi', 'Rosa', 'Member', 'member', true, 'en', 'AU', 'Australia/Sydney', NOW(), NOW()),

  -- Team 9: Rho Analytics (Pro, monthly, canceled voluntary)
  ('usr-rho-owner', 'rho.owner@nextspark.dev', 'Samuel Rho', 'Samuel', 'Rho', 'member', true, 'en', 'CA', 'America/Toronto', NOW(), NOW()),
  ('usr-rho-admin', 'rho.admin@nextspark.dev', 'Teresa Rho', 'Teresa', 'Admin', 'member', true, 'en', 'CA', 'America/Toronto', NOW(), NOW()),
  ('usr-rho-member', 'rho.member@nextspark.dev', 'Ulises Rho', 'Ulises', 'Member', 'member', true, 'en', 'CA', 'America/Toronto', NOW(), NOW()),

  -- Team 10: Sigma Media (Pro, yearly, canceled payment failed)
  ('usr-sigma-owner', 'sigma.owner@nextspark.dev', 'Valeria Sigma', 'Valeria', 'Sigma', 'member', true, 'es', 'AR', 'America/Argentina/Buenos_Aires', NOW(), NOW()),
  ('usr-sigma-admin', 'sigma.admin@nextspark.dev', 'Walter Sigma', 'Walter', 'Admin', 'member', true, 'es', 'AR', 'America/Argentina/Buenos_Aires', NOW(), NOW()),
  ('usr-sigma-member', 'sigma.member@nextspark.dev', 'Ximena Sigma', 'Ximena', 'Member', 'member', true, 'es', 'AR', 'America/Argentina/Buenos_Aires', NOW(), NOW()),

  -- Team 11: Tau Engineering (Free, monthly, active)
  ('usr-tau-owner', 'tau.owner@nextspark.dev', 'Yolanda Tau', 'Yolanda', 'Tau', 'member', true, 'en', 'IN', 'Asia/Kolkata', NOW(), NOW()),
  ('usr-tau-admin', 'tau.admin@nextspark.dev', 'Zack Tau', 'Zack', 'Admin', 'member', true, 'en', 'IN', 'Asia/Kolkata', NOW(), NOW()),
  ('usr-tau-member', 'tau.member@nextspark.dev', 'Amanda Tau', 'Amanda', 'Member', 'member', true, 'en', 'IN', 'Asia/Kolkata', NOW(), NOW()),

  -- Team 12: Upsilon Studios (Enterprise, monthly, active)
  ('usr-upsilon-owner', 'upsilon.owner@nextspark.dev', 'Bruno Upsilon', 'Bruno', 'Upsilon', 'member', true, 'en', 'DE', 'Europe/Berlin', NOW(), NOW()),
  ('usr-upsilon-admin', 'upsilon.admin@nextspark.dev', 'Claudia Upsilon', 'Claudia', 'Admin', 'member', true, 'en', 'DE', 'Europe/Berlin', NOW(), NOW()),
  ('usr-upsilon-member', 'upsilon.member@nextspark.dev', 'David Upsilon', 'David', 'Member', 'member', true, 'en', 'DE', 'Europe/Berlin', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- TEAMS for 10 new workspaces
INSERT INTO "teams" (id, name, slug, description, "ownerId", "createdAt", "updatedAt") VALUES
  ('team-lambda', 'Lambda Labs', 'lambda-labs', 'Enterprise R&D laboratory', 'usr-lambda-owner', NOW() - INTERVAL '18 months', NOW()),
  ('team-mu', 'Mu Ventures', 'mu-ventures', 'VC-backed startup incubator', 'usr-mu-owner', NOW() - INTERVAL '14 months', NOW()),
  ('team-nu', 'Nu Digital', 'nu-digital', 'Digital marketing agency', 'usr-nu-owner', NOW() - INTERVAL '10 months', NOW()),
  ('team-xi', 'Xi Consulting', 'xi-consulting', 'Business consulting firm', 'usr-xi-owner', NOW() - INTERVAL '8 months', NOW()),
  ('team-omicron', 'Omicron Tech', 'omicron-tech', 'Technology startup (trial)', 'usr-omicron-owner', NOW() - INTERVAL '10 days', NOW()),
  ('team-pi', 'Pi Systems', 'pi-systems', 'Systems integration company', 'usr-pi-owner', NOW() - INTERVAL '5 months', NOW()),
  ('team-rho', 'Rho Analytics', 'rho-analytics', 'Data analytics consultancy', 'usr-rho-owner', NOW() - INTERVAL '12 months', NOW()),
  ('team-sigma', 'Sigma Media', 'sigma-media', 'Media production company', 'usr-sigma-owner', NOW() - INTERVAL '16 months', NOW()),
  ('team-tau', 'Tau Engineering', 'tau-engineering', 'Engineering services (free tier)', 'usr-tau-owner', NOW() - INTERVAL '2 months', NOW()),
  ('team-upsilon', 'Upsilon Studios', 'upsilon-studios', 'Game development studio', 'usr-upsilon-owner', NOW() - INTERVAL '6 months', NOW())
ON CONFLICT (id) DO NOTHING;

-- TEAM_MEMBERS for 10 new teams (30 memberships)
INSERT INTO "team_members" (id, "teamId", "userId", role, "invitedBy", "joinedAt") VALUES
  -- Lambda Labs
  ('tm-lambda-owner', 'team-lambda', 'usr-lambda-owner', 'owner', NULL, NOW() - INTERVAL '18 months'),
  ('tm-lambda-admin', 'team-lambda', 'usr-lambda-admin', 'admin', 'usr-lambda-owner', NOW() - INTERVAL '17 months'),
  ('tm-lambda-member', 'team-lambda', 'usr-lambda-member', 'member', 'usr-lambda-owner', NOW() - INTERVAL '16 months'),
  -- Mu Ventures
  ('tm-mu-owner', 'team-mu', 'usr-mu-owner', 'owner', NULL, NOW() - INTERVAL '14 months'),
  ('tm-mu-admin', 'team-mu', 'usr-mu-admin', 'admin', 'usr-mu-owner', NOW() - INTERVAL '13 months'),
  ('tm-mu-member', 'team-mu', 'usr-mu-member', 'member', 'usr-mu-owner', NOW() - INTERVAL '12 months'),
  -- Nu Digital
  ('tm-nu-owner', 'team-nu', 'usr-nu-owner', 'owner', NULL, NOW() - INTERVAL '10 months'),
  ('tm-nu-admin', 'team-nu', 'usr-nu-admin', 'admin', 'usr-nu-owner', NOW() - INTERVAL '9 months'),
  ('tm-nu-member', 'team-nu', 'usr-nu-member', 'member', 'usr-nu-owner', NOW() - INTERVAL '8 months'),
  -- Xi Consulting
  ('tm-xi-owner', 'team-xi', 'usr-xi-owner', 'owner', NULL, NOW() - INTERVAL '8 months'),
  ('tm-xi-admin', 'team-xi', 'usr-xi-admin', 'admin', 'usr-xi-owner', NOW() - INTERVAL '7 months'),
  ('tm-xi-member', 'team-xi', 'usr-xi-member', 'member', 'usr-xi-owner', NOW() - INTERVAL '6 months'),
  -- Omicron Tech (trial)
  ('tm-omicron-owner', 'team-omicron', 'usr-omicron-owner', 'owner', NULL, NOW() - INTERVAL '10 days'),
  ('tm-omicron-admin', 'team-omicron', 'usr-omicron-admin', 'admin', 'usr-omicron-owner', NOW() - INTERVAL '9 days'),
  ('tm-omicron-member', 'team-omicron', 'usr-omicron-member', 'member', 'usr-omicron-owner', NOW() - INTERVAL '8 days'),
  -- Pi Systems (past_due)
  ('tm-pi-owner', 'team-pi', 'usr-pi-owner', 'owner', NULL, NOW() - INTERVAL '5 months'),
  ('tm-pi-admin', 'team-pi', 'usr-pi-admin', 'admin', 'usr-pi-owner', NOW() - INTERVAL '4 months'),
  ('tm-pi-member', 'team-pi', 'usr-pi-member', 'member', 'usr-pi-owner', NOW() - INTERVAL '3 months'),
  -- Rho Analytics (canceled voluntary)
  ('tm-rho-owner', 'team-rho', 'usr-rho-owner', 'owner', NULL, NOW() - INTERVAL '12 months'),
  ('tm-rho-admin', 'team-rho', 'usr-rho-admin', 'admin', 'usr-rho-owner', NOW() - INTERVAL '11 months'),
  ('tm-rho-member', 'team-rho', 'usr-rho-member', 'member', 'usr-rho-owner', NOW() - INTERVAL '10 months'),
  -- Sigma Media (canceled payment failed)
  ('tm-sigma-owner', 'team-sigma', 'usr-sigma-owner', 'owner', NULL, NOW() - INTERVAL '16 months'),
  ('tm-sigma-admin', 'team-sigma', 'usr-sigma-admin', 'admin', 'usr-sigma-owner', NOW() - INTERVAL '15 months'),
  ('tm-sigma-member', 'team-sigma', 'usr-sigma-member', 'member', 'usr-sigma-owner', NOW() - INTERVAL '14 months'),
  -- Tau Engineering (free)
  ('tm-tau-owner', 'team-tau', 'usr-tau-owner', 'owner', NULL, NOW() - INTERVAL '2 months'),
  ('tm-tau-admin', 'team-tau', 'usr-tau-admin', 'admin', 'usr-tau-owner', NOW() - INTERVAL '6 weeks'),
  ('tm-tau-member', 'team-tau', 'usr-tau-member', 'member', 'usr-tau-owner', NOW() - INTERVAL '1 month'),
  -- Upsilon Studios
  ('tm-upsilon-owner', 'team-upsilon', 'usr-upsilon-owner', 'owner', NULL, NOW() - INTERVAL '6 months'),
  ('tm-upsilon-admin', 'team-upsilon', 'usr-upsilon-admin', 'admin', 'usr-upsilon-owner', NOW() - INTERVAL '5 months'),
  ('tm-upsilon-member', 'team-upsilon', 'usr-upsilon-member', 'member', 'usr-upsilon-owner', NOW() - INTERVAL '4 months')
ON CONFLICT (id) DO NOTHING;

-- ACCOUNTS for 30 new users (Password: Test1234)
INSERT INTO "account" (
  id, "userId", "accountId", "providerId",
  "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope",
  "password", "createdAt", "updatedAt"
) VALUES
  ('acc-lambda-owner', 'usr-lambda-owner', 'lambda.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-lambda-admin', 'usr-lambda-admin', 'lambda.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-lambda-member', 'usr-lambda-member', 'lambda.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-mu-owner', 'usr-mu-owner', 'mu.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-mu-admin', 'usr-mu-admin', 'mu.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-mu-member', 'usr-mu-member', 'mu.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-nu-owner', 'usr-nu-owner', 'nu.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-nu-admin', 'usr-nu-admin', 'nu.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-nu-member', 'usr-nu-member', 'nu.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-xi-owner', 'usr-xi-owner', 'xi.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-xi-admin', 'usr-xi-admin', 'xi.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-xi-member', 'usr-xi-member', 'xi.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-omicron-owner', 'usr-omicron-owner', 'omicron.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-omicron-admin', 'usr-omicron-admin', 'omicron.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-omicron-member', 'usr-omicron-member', 'omicron.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-pi-owner', 'usr-pi-owner', 'pi.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-pi-admin', 'usr-pi-admin', 'pi.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-pi-member', 'usr-pi-member', 'pi.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-rho-owner', 'usr-rho-owner', 'rho.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-rho-admin', 'usr-rho-admin', 'rho.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-rho-member', 'usr-rho-member', 'rho.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-sigma-owner', 'usr-sigma-owner', 'sigma.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-sigma-admin', 'usr-sigma-admin', 'sigma.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-sigma-member', 'usr-sigma-member', 'sigma.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-tau-owner', 'usr-tau-owner', 'tau.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-tau-admin', 'usr-tau-admin', 'tau.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-tau-member', 'usr-tau-member', 'tau.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-upsilon-owner', 'usr-upsilon-owner', 'upsilon.owner@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-upsilon-admin', 'usr-upsilon-admin', 'upsilon.admin@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-upsilon-member', 'usr-upsilon-member', 'upsilon.member@nextspark.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW())
ON CONFLICT ("providerId", "accountId") DO NOTHING;

-- DELETE trigger-created subscriptions for new teams
DELETE FROM public."subscriptions" WHERE "teamId" IN (
  'team-lambda', 'team-mu', 'team-nu', 'team-xi', 'team-omicron',
  'team-pi', 'team-rho', 'team-sigma', 'team-tau', 'team-upsilon'
);

-- SUBSCRIPTIONS for 10 new teams (diverse scenarios)
INSERT INTO public."subscriptions" (
  id, "teamId", "planId", status,
  "currentPeriodStart", "currentPeriodEnd", "billingInterval",
  "trialEndsAt", "canceledAt", "cancelAtPeriodEnd",
  "paymentProvider", "externalSubscriptionId", "externalCustomerId", "createdAt"
) VALUES
  -- Lambda Labs: Enterprise, yearly, active (18 months history)
  ('sub-lambda', 'team-lambda', 'plan_enterprise', 'active',
   NOW() - INTERVAL '6 months', NOW() + INTERVAL '6 months', 'yearly',
   NULL, NULL, false,
   'stripe', 'sub_stripe_lambda', 'cus_lambda', NOW() - INTERVAL '18 months'),

  -- Mu Ventures: Enterprise, yearly, active (14 months history)
  ('sub-mu', 'team-mu', 'plan_enterprise', 'active',
   NOW() - INTERVAL '2 months', NOW() + INTERVAL '10 months', 'yearly',
   NULL, NULL, false,
   'stripe', 'sub_stripe_mu', 'cus_mu', NOW() - INTERVAL '14 months'),

  -- Nu Digital: Pro, yearly, active (10 months history)
  ('sub-nu', 'team-nu', 'plan_pro', 'active',
   NOW() - INTERVAL '10 months', NOW() + INTERVAL '2 months', 'yearly',
   NULL, NULL, false,
   'stripe', 'sub_stripe_nu', 'cus_nu', NOW() - INTERVAL '10 months'),

  -- Xi Consulting: Pro, monthly, active (8 months history)
  ('sub-xi', 'team-xi', 'plan_pro', 'active',
   NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 'monthly',
   NULL, NULL, false,
   'stripe', 'sub_stripe_xi', 'cus_xi', NOW() - INTERVAL '8 months'),

  -- Omicron Tech: Pro, monthly, trialing (10 days old, trial ends in 4 days)
  ('sub-omicron', 'team-omicron', 'plan_pro', 'trialing',
   NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 'monthly',
   NOW() + INTERVAL '4 days', NULL, false,
   'stripe', 'sub_stripe_omicron', 'cus_omicron', NOW() - INTERVAL '10 days'),

  -- Pi Systems: Pro, monthly, past_due (payment failed 5 days ago)
  ('sub-pi', 'team-pi', 'plan_pro', 'past_due',
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '5 days', 'monthly',
   NULL, NULL, false,
   'stripe', 'sub_stripe_pi', 'cus_pi', NOW() - INTERVAL '5 months'),

  -- Rho Analytics: Pro, monthly, canceled (voluntary, 8 months paid then canceled)
  ('sub-rho', 'team-rho', 'plan_pro', 'canceled',
   NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 month', 'monthly',
   NULL, NOW() - INTERVAL '1 month', false,
   'stripe', 'sub_stripe_rho', 'cus_rho', NOW() - INTERVAL '12 months'),

  -- Sigma Media: Pro, yearly, canceled (payment failed after 1 year)
  ('sub-sigma', 'team-sigma', 'plan_pro', 'canceled',
   NOW() - INTERVAL '4 months', NOW() - INTERVAL '2 weeks', 'yearly',
   NULL, NOW() - INTERVAL '2 weeks', false,
   'stripe', 'sub_stripe_sigma', 'cus_sigma', NOW() - INTERVAL '16 months'),

  -- Tau Engineering: Free, monthly, active
  ('sub-tau', 'team-tau', 'plan_free', 'active',
   NOW() - INTERVAL '2 months', NOW() + INTERVAL '28 days', 'monthly',
   NULL, NULL, false,
   NULL, NULL, NULL, NOW() - INTERVAL '2 months'),

  -- Upsilon Studios: Enterprise, monthly, active (6 months history)
  ('sub-upsilon', 'team-upsilon', 'plan_enterprise', 'active',
   NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 'monthly',
   NULL, NULL, false,
   'stripe', 'sub_stripe_upsilon', 'cus_upsilon', NOW() - INTERVAL '6 months')
ON CONFLICT (id) DO NOTHING;

-- BILLING EVENTS for 10 new teams (coherent payment history)
INSERT INTO public."billing_events" (id, "subscriptionId", type, status, amount, currency, "createdAt") VALUES
  -- Lambda Labs: 2 yearly payments @ $4,990/yr (499000 cents)
  ('be-lambda-001', 'sub-lambda', 'payment', 'succeeded', 499000, 'usd', NOW() - INTERVAL '18 months'),
  ('be-lambda-002', 'sub-lambda', 'payment', 'succeeded', 499000, 'usd', NOW() - INTERVAL '6 months'),

  -- Mu Ventures: 2 yearly payments @ $4,990/yr (499000 cents)
  ('be-mu-001', 'sub-mu', 'payment', 'succeeded', 499000, 'usd', NOW() - INTERVAL '14 months'),
  ('be-mu-002', 'sub-mu', 'payment', 'succeeded', 499000, 'usd', NOW() - INTERVAL '2 months'),

  -- Nu Digital: 1 yearly payment @ $290/yr (29000 cents)
  ('be-nu-001', 'sub-nu', 'payment', 'succeeded', 29000, 'usd', NOW() - INTERVAL '10 months'),

  -- Xi Consulting: 8 monthly payments @ $29/mo (2900 cents)
  ('be-xi-001', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '8 months'),
  ('be-xi-002', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '7 months'),
  ('be-xi-003', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '6 months'),
  ('be-xi-004', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-xi-005', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-xi-006', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-xi-007', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-xi-008', 'sub-xi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '1 month'),

  -- Omicron Tech: No payments (still in trial)
  -- (no billing events)

  -- Pi Systems: 4 successful + 1 failed payment @ $29/mo
  ('be-pi-001', 'sub-pi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-pi-002', 'sub-pi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-pi-003', 'sub-pi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-pi-004', 'sub-pi', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-pi-005', 'sub-pi', 'payment', 'failed', 2900, 'usd', NOW() - INTERVAL '5 days'),

  -- Rho Analytics: 8 successful then voluntary cancel @ $29/mo
  -- (cancellation tracked in subscription.canceledAt, not in billing_events)
  ('be-rho-001', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '12 months'),
  ('be-rho-002', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '11 months'),
  ('be-rho-003', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '10 months'),
  ('be-rho-004', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '9 months'),
  ('be-rho-005', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '8 months'),
  ('be-rho-006', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '7 months'),
  ('be-rho-007', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '6 months'),
  ('be-rho-008', 'sub-rho', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '5 months'),

  -- Sigma Media: 1 yearly payment + 1 failed renewal @ $290/yr
  -- (cancellation tracked in subscription.canceledAt)
  ('be-sigma-001', 'sub-sigma', 'payment', 'succeeded', 29000, 'usd', NOW() - INTERVAL '16 months'),
  ('be-sigma-002', 'sub-sigma', 'payment', 'failed', 29000, 'usd', NOW() - INTERVAL '2 weeks'),

  -- Tau Engineering: No payments (free plan)
  -- (no billing events)

  -- Upsilon Studios: 6 monthly payments @ $499/mo (49900 cents)
  ('be-upsilon-001', 'sub-upsilon', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '6 months'),
  ('be-upsilon-002', 'sub-upsilon', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-upsilon-003', 'sub-upsilon', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-upsilon-004', 'sub-upsilon', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-upsilon-005', 'sub-upsilon', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-upsilon-006', 'sub-upsilon', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- TEAM METADATA for 10 new teams
UPDATE public."teams" SET metadata = '{"workspaceType": "research", "industry": "biotech", "memberCount": 3}'::jsonb WHERE id = 'team-lambda';
UPDATE public."teams" SET metadata = '{"workspaceType": "incubator", "industry": "fintech", "memberCount": 3}'::jsonb WHERE id = 'team-mu';
UPDATE public."teams" SET metadata = '{"workspaceType": "agency", "industry": "marketing", "memberCount": 3}'::jsonb WHERE id = 'team-nu';
UPDATE public."teams" SET metadata = '{"workspaceType": "consulting", "industry": "business", "memberCount": 3}'::jsonb WHERE id = 'team-xi';
UPDATE public."teams" SET metadata = '{"workspaceType": "startup", "industry": "saas", "memberCount": 3}'::jsonb WHERE id = 'team-omicron';
UPDATE public."teams" SET metadata = '{"workspaceType": "enterprise", "industry": "systems", "memberCount": 3}'::jsonb WHERE id = 'team-pi';
UPDATE public."teams" SET metadata = '{"workspaceType": "consultancy", "industry": "data", "memberCount": 3}'::jsonb WHERE id = 'team-rho';
UPDATE public."teams" SET metadata = '{"workspaceType": "production", "industry": "media", "memberCount": 3}'::jsonb WHERE id = 'team-sigma';
UPDATE public."teams" SET metadata = '{"workspaceType": "services", "industry": "engineering", "memberCount": 3}'::jsonb WHERE id = 'team-tau';
UPDATE public."teams" SET metadata = '{"workspaceType": "studio", "industry": "gaming", "memberCount": 3}'::jsonb WHERE id = 'team-upsilon';

-- ============================================
-- SUCCESS SUMMARY
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Productivity Theme Sample Data - Multi-Tenant Mode';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  👥 ORIGINAL TEST USERS (password: Test1234):';
  RAISE NOTICE '     prod_owner_patricia@nextspark.dev  → owner (both teams)';
  RAISE NOTICE '     prod_admin_member_lucas@nextspark.dev → admin (Product), member (Marketing)';
  RAISE NOTICE '     prod_member_diana@nextspark.dev    → member (Product only)';
  RAISE NOTICE '     prod_member_marcos@nextspark.dev   → member (Marketing only)';
  RAISE NOTICE '';
  RAISE NOTICE '  🏢 ALL 12 TEAMS:';
  RAISE NOTICE '     1. Product Team     - Pro $29/mo  monthly  active';
  RAISE NOTICE '     2. Marketing Hub    - Pro $29/mo  monthly  active';
  RAISE NOTICE '     3. Lambda Labs      - Ent $499/mo yearly   active';
  RAISE NOTICE '     4. Mu Ventures      - Ent $499/mo yearly   active';
  RAISE NOTICE '     5. Nu Digital       - Pro $29/mo  yearly   active';
  RAISE NOTICE '     6. Xi Consulting    - Pro $29/mo  monthly  active';
  RAISE NOTICE '     7. Omicron Tech     - Pro $29/mo  monthly  trialing';
  RAISE NOTICE '     8. Pi Systems       - Pro $29/mo  monthly  past_due';
  RAISE NOTICE '     9. Rho Analytics    - Pro $29/mo  monthly  canceled (voluntary)';
  RAISE NOTICE '    10. Sigma Media      - Pro $29/mo  yearly   canceled (payment failed)';
  RAISE NOTICE '    11. Tau Engineering  - Free        monthly  active';
  RAISE NOTICE '    12. Upsilon Studios  - Ent $499/mo monthly  active';
  RAISE NOTICE '';
  RAISE NOTICE '  📊 SUBSCRIPTION STATS:';
  RAISE NOTICE '     Active: 8 (incl 1 trialing) | Past Due: 1 | Canceled: 2 | Free: 1';
  RAISE NOTICE '     MRR: ~$1,085 (4 Pro monthly + 1 Enterprise monthly)';
  RAISE NOTICE '     ARR: ~$10,268 (2 Enterprise yearly + 1 Pro yearly)';
  RAISE NOTICE '';
  RAISE NOTICE '  📝 TEAMS MODE: multi-tenant (B2B)';
  RAISE NOTICE '     - Team switcher enabled';
  RAISE NOTICE '     - Can create new teams';
  RAISE NOTICE '     - Invitations enabled (owner/admin can invite)';
  RAISE NOTICE '     - Subscriptions belong to team (no userId)';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
