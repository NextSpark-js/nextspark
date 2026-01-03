-- ============================================================================
-- CRM Theme - Sample Data Migration
-- Scenario: Single-tenant (one company, multiple users with different roles)
-- Teams Mode: single-tenant
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes') THEN
    TRUNCATE "notes" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') THEN
    TRUNCATE "activities" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunities') THEN
    TRUNCATE "opportunities" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
    TRUNCATE "campaigns" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
    TRUNCATE "contacts" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    TRUNCATE "leads" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    TRUNCATE "companies" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    TRUNCATE "products" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipelines') THEN
    TRUNCATE "pipelines" CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    TRUNCATE "invoices" CASCADE;
  END IF;

  -- Note: personal team deletion trigger removed in simplified architecture
  
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
  
  -- Cleanup complete
  
  RAISE NOTICE 'CRM theme cleanup complete. Superadmin preserved.';
END $$;

-- ============================================
-- STEP 1: CREATE USERS
-- ============================================
-- Single-tenant: 4 users in one company with different roles

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
  -- CEO / Owner
  (
    'usr-crm-ceo',
    'crm_owner_roberto@nextspark.dev',
    'Roberto Martínez',
    'Roberto',
    'Martínez',
    'member',
    true,
    'es',
    'ES',
    'Europe/Madrid',
    NOW(),
    NOW()
  ),
  -- Sales Manager / Admin
  (
    'usr-crm-sales-mgr',
    'crm_admin_sofia@nextspark.dev',
    'Sofía Gómez',
    'Sofía',
    'Gómez',
    'member',
    true,
    'es',
    'AR',
    'America/Argentina/Buenos_Aires',
    NOW(),
    NOW()
  ),
  -- Sales Rep / Member
  (
    'usr-crm-sales-rep',
    'crm_member_miguel@nextspark.dev',
    'Miguel Castro',
    'Miguel',
    'Castro',
    'member',
    true,
    'es',
    'MX',
    'America/Mexico_City',
    NOW(),
    NOW()
  ),
  -- Marketing / Member
  (
    'usr-crm-marketing',
    'crm_member_laura@nextspark.dev',
    'Laura Vega',
    'Laura',
    'Vega',
    'member',
    true,
    'en',
    'US',
    'America/New_York',
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- STEP 2: CREATE TEAM
-- ============================================
-- Single-tenant: Only ONE work team (the company)

INSERT INTO "teams" (
  id,
  name,
  slug,
  description,
  "ownerId",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'team-crm-company',
    'Ventas Pro S.A.',
    'ventas-pro-sa',
    'Enterprise CRM for Ventas Pro sales team',
    'usr-crm-ceo',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 3: CREATE TEAM MEMBERSHIPS
-- ============================================

INSERT INTO "team_members" (
  id,
  "teamId",
  "userId",
  role,
  "joinedAt"
) VALUES
  -- Owner - CEO has full control
  ('tm-crm-ceo', 'team-crm-company', 'usr-crm-ceo', 'owner', NOW()),
  -- Admin - Sales Manager can manage team
  ('tm-crm-sales-mgr', 'team-crm-company', 'usr-crm-sales-mgr', 'admin', NOW()),
  -- Member - Sales Rep can work with leads/contacts
  ('tm-crm-sales-rep', 'team-crm-company', 'usr-crm-sales-rep', 'member', NOW()),
  -- Member - Marketing focuses on campaigns
  ('tm-crm-marketing', 'team-crm-company', 'usr-crm-marketing', 'member', NOW())
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
    'acc-crm-ceo',
    'usr-crm-ceo',
    'crm_owner_roberto@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(),
    NOW()
  ),
  (
    'acc-crm-sales-mgr',
    'usr-crm-sales-mgr',
    'crm_admin_sofia@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(),
    NOW()
  ),
  (
    'acc-crm-sales-rep',
    'usr-crm-sales-rep',
    'crm_member_miguel@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(),
    NOW()
  ),
  (
    'acc-crm-marketing',
    'usr-crm-marketing',
    'crm_member_laura@nextspark.dev',
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
  ('usr-crm-ceo', 'activeTeamId', '"team-crm-company"', 'json', false, false, NOW(), NOW()),
  ('usr-crm-ceo', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-crm-sales-mgr', 'activeTeamId', '"team-crm-company"', 'json', false, false, NOW(), NOW()),
  ('usr-crm-sales-mgr', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-crm-sales-rep', 'activeTeamId', '"team-crm-company"', 'json', false, false, NOW(), NOW()),
  ('usr-crm-sales-rep', 'uiPreferences', '{"theme": "dark", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-crm-marketing', 'activeTeamId', '"team-crm-company"', 'json', false, false, NOW(), NOW()),
  ('usr-crm-marketing', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW())
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
    'apikey-crm-ceo',
    'usr-crm-ceo',
    'CEO API Key',
    'd1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2',
    'testkey_crm00001',
    ARRAY['*'],
    NULL,
    NOW(),
    NOW(),
    'active'
  ),
  (
    'apikey-crm-sales-mgr',
    'usr-crm-sales-mgr',
    'Sales Manager API Key',
    'e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3',
    'testkey_crm00002',
    ARRAY['leads:read', 'leads:write', 'contacts:read', 'contacts:write', 'opportunities:read', 'opportunities:write'],
    NULL,
    NOW(),
    NOW(),
    'active'
  ),
  (
    'apikey-crm-sales-rep',
    'usr-crm-sales-rep',
    'Sales Rep API Key',
    'f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4',
    'testkey_crm00003',
    ARRAY['leads:read', 'leads:write', 'contacts:read', 'opportunities:read'],
    NULL,
    NOW(),
    NOW(),
    'active'
  ),
  (
    'apikey-crm-marketing',
    'usr-crm-marketing',
    'Marketing API Key',
    'a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5',
    'testkey_crm00004',
    ARRAY['campaigns:read', 'campaigns:write', 'leads:read'],
    NULL,
    NOW(),
    NOW(),
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 8: CREATE INVOICES
-- ============================================
-- Ventas Pro S.A. subscription: $499/month (Enterprise Plan)
-- 6 months history: 5 paid + 1 pending (current)
-- Total: $2,994 ($2,495 paid + $499 pending)

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
  -- Ventas Pro S.A. - 6 months of subscription history ($499/month Enterprise Plan)
  ('inv-crm-001', 'team-crm-company', 'INV-CRM-001',
   NOW() - INTERVAL '5 months', 499.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-crm-001.pdf',
   'Enterprise Plan - Monthly subscription'),
  ('inv-crm-002', 'team-crm-company', 'INV-CRM-002',
   NOW() - INTERVAL '4 months', 499.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-crm-002.pdf',
   'Enterprise Plan - Monthly subscription'),
  ('inv-crm-003', 'team-crm-company', 'INV-CRM-003',
   NOW() - INTERVAL '3 months', 499.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-crm-003.pdf',
   'Enterprise Plan - Monthly subscription'),
  ('inv-crm-004', 'team-crm-company', 'INV-CRM-004',
   NOW() - INTERVAL '2 months', 499.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-crm-004.pdf',
   'Enterprise Plan - Monthly subscription'),
  ('inv-crm-005', 'team-crm-company', 'INV-CRM-005',
   NOW() - INTERVAL '1 month', 499.00, 'USD', 'paid',
   'https://billing.example.com/invoices/inv-crm-005.pdf',
   'Enterprise Plan - Monthly subscription'),
  ('inv-crm-006', 'team-crm-company', 'INV-CRM-006',
   NOW(), 499.00, 'USD', 'pending',
   NULL,  -- No PDF yet for pending invoice
   'Enterprise Plan - Monthly subscription')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 9: SUBSCRIPTIONS (B2B - without userId)
-- ============================================
-- Note: CRM theme is single-tenant B2B - NO userId
-- Subscription belongs to team, not individual user
-- IMPORTANT: Delete trigger-created free subscription before explicit INSERT

DELETE FROM public."subscriptions" WHERE "teamId" = 'team-crm-company';

INSERT INTO public."subscriptions" (
  id, "teamId", "planId", status,
  "currentPeriodStart", "currentPeriodEnd", "billingInterval", "paymentProvider",
  "externalSubscriptionId", "externalCustomerId", "createdAt"
) VALUES
  -- Ventas Pro S.A. → Enterprise Plan $499/mo (active, monthly)
  ('sub-crm-company', 'team-crm-company', 'plan_enterprise', 'active',
   NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 'monthly', 'stripe',
   'sub_stripe_ventaspro', 'cus_ventaspro', NOW() - INTERVAL '6 months')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 10: BILLING EVENTS (6 months @ $499 Enterprise)
-- ============================================

INSERT INTO public."billing_events" (id, "subscriptionId", type, status, amount, currency, "createdAt")
VALUES
  ('be-crm-001', 'sub-crm-company', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '6 months'),
  ('be-crm-002', 'sub-crm-company', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-crm-003', 'sub-crm-company', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-crm-004', 'sub-crm-company', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-crm-005', 'sub-crm-company', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-crm-006', 'sub-crm-company', 'payment', 'succeeded', 49900, 'usd', NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 11: TEAM METADATA (B2B enterprise attributes)
-- ============================================

UPDATE public."teams" SET metadata = '{"industry": "sales", "employeeCount": 4, "segment": "enterprise", "ssoEnabled": false}'::jsonb WHERE id = 'team-crm-company';

-- ============================================
-- SUCCESS SUMMARY
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  CRM Theme Sample Data - Single-tenant B2B';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  👥 TEST USERS (all passwords: Test1234):';
  RAISE NOTICE '     crm_owner_roberto@nextspark.dev  → owner (full access)';
  RAISE NOTICE '     crm_admin_sofia@nextspark.dev    → admin (sales manager)';
  RAISE NOTICE '     crm_member_miguel@nextspark.dev  → member (sales rep)';
  RAISE NOTICE '     crm_member_laura@nextspark.dev   → member (marketing)';
  RAISE NOTICE '';
  RAISE NOTICE '  🏢 TEAM (Single-tenant = 1 company):';
  RAISE NOTICE '     Ventas Pro S.A. - 4 members';
  RAISE NOTICE '     Plan: Enterprise $499/mo (active, monthly)';
  RAISE NOTICE '     Billing: 6 months history ($2,994 total)';
  RAISE NOTICE '';
  RAISE NOTICE '  📊 SUBSCRIPTION:';
  RAISE NOTICE '     MRR: $499.00 (1 Enterprise monthly)';
  RAISE NOTICE '     Status: Active';
  RAISE NOTICE '';
  RAISE NOTICE '  📝 TEAMS MODE: single-tenant (B2B)';
  RAISE NOTICE '     - No team switcher (only one team)';
  RAISE NOTICE '     - Cannot create additional teams';
  RAISE NOTICE '     - Subscription belongs to team (no userId)';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

