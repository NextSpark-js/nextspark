-- Migration: 092_billing_sample_data.sql
-- Description: Sample billing data for theme - plans, subscriptions, usage, and billing events
-- Date: 2025-12-25
-- Updated: 2025-12-26 - Added plans INSERT (moved from core)
-- Theme: default
-- Phase: Theme sample data - runs AFTER 091_greek_teams_billing.sql
--
-- This file contains billing sample data for:
-- - Sample plans (Free, Pro, Enterprise)
-- - TMT.dev company teams (Everpoint, Ironvale, Riverstone)
-- - TMT.dev personal teams (Carlos, etc.)
-- - Greek alphabet teams (Alpha through Omicron)
-- - TMT core team (superadmin + developer)
--
-- NOTE: Helper functions are in core migration 017_billing_functions.sql
-- NOTE: The trigger `create_default_subscription` auto-creates free subscriptions
--       when teams are created. We delete those to replace with our sample data.

-- ============================================
-- SAMPLE PLANS
-- ============================================

-- Plan: Free
INSERT INTO public."plans" (
  id,
  slug,
  name,
  description,
  type,
  visibility,
  "priceMonthly",
  "priceYearly",
  "trialDays",
  features,
  limits,
  "sortOrder"
) VALUES (
  'plan_free',
  'free',
  'Free',
  'Free plan to get started',
  'free',
  'public',
  0,
  0,
  0,
  '["basic_analytics"]'::jsonb,
  '{"team_members": 3, "tasks": 50, "customers": 25, "storage_gb": 1, "api_calls": 1000, "file_uploads": 100, "webhooks_count": 0}'::jsonb,
  1
) ON CONFLICT (slug) DO NOTHING;

-- Plan: Pro
INSERT INTO public."plans" (
  id,
  slug,
  name,
  description,
  type,
  visibility,
  "priceMonthly",
  "priceYearly",
  "trialDays",
  features,
  limits,
  "sortOrder"
) VALUES (
  'plan_pro',
  'pro',
  'Pro',
  'Professional plan for teams',
  'paid',
  'public',
  2900,
  29000,
  14,
  '["basic_analytics", "advanced_analytics", "realtime_analytics", "api_access", "webhooks", "custom_branding", "guest_access", "priority_support", "task_automation"]'::jsonb,
  '{"team_members": 15, "tasks": 1000, "customers": 500, "storage_gb": 50, "api_calls": 100000, "file_uploads": 2000, "webhooks_count": 10}'::jsonb,
  2
) ON CONFLICT (slug) DO NOTHING;

-- Plan: Enterprise
INSERT INTO public."plans" (
  id,
  slug,
  name,
  description,
  type,
  visibility,
  "priceMonthly",
  "priceYearly",
  "trialDays",
  features,
  limits,
  "sortOrder"
) VALUES (
  'plan_enterprise',
  'enterprise',
  'Enterprise',
  'Custom enterprise plan with unlimited features',
  'enterprise',
  'hidden',
  49900,   -- $499.00/mo
  499000,  -- $4,990.00/yr (2 months free)
  30,
  '["*"]'::jsonb,
  '{"team_members": -1, "projects": -1, "storage_gb": -1, "api_calls": -1}'::jsonb,
  3
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- CLEANUP: Remove auto-created subscriptions
-- ============================================
-- These were created by the trigger when teams were inserted.
-- We want to replace them with more detailed sample subscriptions.

DELETE FROM public."subscriptions" WHERE "teamId" IN (
  'team-everpoint-001',
  'team-ironvale-002',
  'team-riverstone-003',
  'team-personal-carlos-001',
  'team-nextspark-001',
  'team-alpha-001',
  'team-beta-002',
  'team-gamma-003',
  'team-delta-004',
  'team-epsilon-005',
  'team-zeta-006',
  'team-eta-007',
  'team-theta-008',
  'team-iota-009',
  'team-kappa-010',
  'team-lambda-011',
  'team-mu-012',
  'team-nu-013',
  'team-xi-014',
  'team-omicron-015'
);

-- ============================================
-- SAMPLE SUBSCRIPTIONS - TMT.DEV TEAMS
-- ============================================

-- Company Teams - Paid Plans
INSERT INTO public."subscriptions" (
  id,
  "teamId",
  "planId",
  status,
  "currentPeriodStart",
  "currentPeriodEnd",
  "billingInterval",
  "paymentProvider",
  "externalSubscriptionId",
  "externalCustomerId",
  "createdAt"
) VALUES
  -- Everpoint Labs → Pro Plan (active, $29/mo)
  (
    'sub-everpoint-001',
    'team-everpoint-001',
    'plan_pro',
    'active',
    NOW() - INTERVAL '15 days',
    NOW() + INTERVAL '15 days',
    'monthly',
    'stripe',
    'sub_everpoint_stripe_001',
    'cus_everpoint_001',
    NOW() - INTERVAL '60 days'
  ),
  -- Ironvale Global → Enterprise Plan (active, $499/mo)
  (
    'sub-ironvale-001',
    'team-ironvale-002',
    'plan_enterprise',
    'active',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '20 days',
    'monthly',
    'stripe',
    'sub_ironvale_stripe_001',
    'cus_ironvale_001',
    NOW() - INTERVAL '45 days'
  ),
  -- Riverstone Ventures → Pro Plan (trialing, 14-day trial)
  (
    'sub-riverstone-001',
    'team-riverstone-003',
    'plan_pro',
    'trialing',
    NOW(),
    NOW() + INTERVAL '30 days',
    'monthly',
    NULL,
    NULL,
    NULL,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Add trialEndsAt for trialing subscription
UPDATE public."subscriptions"
SET "trialEndsAt" = NOW() + INTERVAL '14 days'
WHERE id = 'sub-riverstone-001';

-- Personal Teams - Free Plans
INSERT INTO public."subscriptions" (
  id,
  "teamId",
  "planId",
  status,
  "currentPeriodStart",
  "currentPeriodEnd",
  "billingInterval",
  "createdAt"
) VALUES
  -- Carlos Personal Team → Free Plan
  (
    'sub-personal-carlos-001',
    'team-personal-carlos-001',
    'plan_free',
    'active',
    NOW(),
    NOW() + INTERVAL '100 years',
    'monthly',
    NOW() - INTERVAL '45 days'
  ),
  -- NextSpark Team → Pro Plan (for superadmin testing)
  (
    'sub-nextspark-001',
    'team-nextspark-001',
    'plan_pro',
    'active',
    NOW() - INTERVAL '60 days',
    NOW() + INTERVAL '30 days',
    'monthly',
    NOW() - INTERVAL '120 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Add externalCustomerId for NextSpark team (for portal testing)
UPDATE public."subscriptions"
SET
  "paymentProvider" = 'stripe',
  "externalSubscriptionId" = 'sub_nextspark_stripe_001',
  "externalCustomerId" = 'cus_nextspark_001'
WHERE id = 'sub-nextspark-001';

-- ============================================
-- SAMPLE BILLING EVENTS (Payment History)
-- ============================================

INSERT INTO public."billing_events" (
  id,
  "subscriptionId",
  type,
  status,
  amount,
  currency,
  "externalPaymentId",
  "createdAt"
) VALUES
  -- Everpoint Labs payments (2 months history)
  ('be-ever-001', 'sub-everpoint-001', 'payment', 'succeeded', 2900, 'usd', 'pi_ever_001', NOW() - INTERVAL '60 days'),
  ('be-ever-002', 'sub-everpoint-001', 'payment', 'succeeded', 2900, 'usd', 'pi_ever_002', NOW() - INTERVAL '30 days'),

  -- Ironvale Global (enterprise, $499/mo)
  ('be-iron-001', 'sub-ironvale-001', 'payment', 'succeeded', 49900, 'usd', 'pi_iron_001', NOW() - INTERVAL '45 days'),
  ('be-iron-002', 'sub-ironvale-001', 'payment', 'succeeded', 49900, 'usd', 'pi_iron_002', NOW() - INTERVAL '15 days'),

  -- NextSpark Team payments (for testing portal)
  ('be-nextspark-001', 'sub-nextspark-001', 'payment', 'succeeded', 2900, 'usd', 'pi_nextspark_001', NOW() - INTERVAL '120 days'),
  ('be-nextspark-002', 'sub-nextspark-001', 'payment', 'succeeded', 2900, 'usd', 'pi_nextspark_002', NOW() - INTERVAL '90 days'),
  ('be-nextspark-003', 'sub-nextspark-001', 'payment', 'succeeded', 2900, 'usd', 'pi_nextspark_003', NOW() - INTERVAL '60 days'),
  ('be-nextspark-004', 'sub-nextspark-001', 'payment', 'succeeded', 2900, 'usd', 'pi_nextspark_004', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE USAGE (Aggregate Data)
-- ============================================

INSERT INTO public."usage" (
  id,
  "subscriptionId",
  "limitSlug",
  "periodKey",
  "currentValue",
  "lastIncrementAt",
  "createdAt"
) VALUES
  -- Everpoint Labs usage
  ('usage-ever-members', 'sub-everpoint-001', 'team_members', 'all_time', 4, NOW() - INTERVAL '45 days', NOW() - INTERVAL '60 days'),
  ('usage-ever-projects', 'sub-everpoint-001', 'projects', 'all_time', 12, NOW() - INTERVAL '5 days', NOW() - INTERVAL '60 days'),
  ('usage-ever-storage', 'sub-everpoint-001', 'storage_gb', 'all_time', 25, NOW() - INTERVAL '2 days', NOW() - INTERVAL '60 days'),
  ('usage-ever-api', 'sub-everpoint-001', 'api_calls', '2024-12', 45000, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 days'),

  -- Ironvale Global usage (enterprise - unlimited, but still tracked)
  ('usage-iron-members', 'sub-ironvale-001', 'team_members', 'all_time', 4, NOW() - INTERVAL '30 days', NOW() - INTERVAL '45 days'),
  ('usage-iron-projects', 'sub-ironvale-001', 'projects', 'all_time', 25, NOW() - INTERVAL '10 days', NOW() - INTERVAL '45 days'),
  ('usage-iron-storage', 'sub-ironvale-001', 'storage_gb', 'all_time', 150, NOW() - INTERVAL '2 days', NOW() - INTERVAL '45 days'),
  ('usage-iron-api', 'sub-ironvale-001', 'api_calls', '2024-12', 250000, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 days'),

  -- NextSpark Team usage
  ('usage-nextspark-members', 'sub-nextspark-001', 'team_members', 'all_time', 2, NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
  ('usage-nextspark-projects', 'sub-nextspark-001', 'projects', 'all_time', 3, NOW() - INTERVAL '30 days', NOW() - INTERVAL '120 days'),
  ('usage-nextspark-api', 'sub-nextspark-001', 'api_calls', '2024-12', 5000, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 days'),

  -- Carlos personal team (free plan)
  ('usage-carlos-projects', 'sub-personal-carlos-001', 'projects', 'all_time', 4, NOW() - INTERVAL '15 days', NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE USAGE EVENTS (Audit Trail)
-- ============================================

INSERT INTO public."usage_events" (
  id,
  "subscriptionId",
  "userId",
  "teamId",
  "limitSlug",
  delta,
  action,
  "resourceType",
  "resourceId",
  "periodKey",
  "createdAt"
) VALUES
  -- Everpoint recent activity
  ('ue-ever-001', 'sub-everpoint-001', 'usr-carlos-001', 'team-everpoint-001', 'projects', 1, 'create_project', 'project', 'proj-ever-001', 'all_time', NOW() - INTERVAL '5 days'),
  ('ue-ever-002', 'sub-everpoint-001', 'usr-james-002', 'team-everpoint-001', 'api_calls', 500, 'api_batch', 'api_request', NULL, '2024-12', NOW() - INTERVAL '1 hour'),

  -- Ironvale recent activity
  ('ue-iron-001', 'sub-ironvale-001', 'usr-ana-005', 'team-ironvale-002', 'projects', 1, 'create_project', 'project', 'proj-iron-001', 'all_time', NOW() - INTERVAL '10 days'),
  ('ue-iron-002', 'sub-ironvale-001', 'usr-ana-005', 'team-ironvale-002', 'api_calls', 1000, 'api_batch', 'api_request', NULL, '2024-12', NOW() - INTERVAL '30 minutes'),

  -- NextSpark Team activity
  ('ue-nextspark-001', 'sub-nextspark-001', 'test-superadmin-001', 'team-nextspark-001', 'projects', 1, 'create_project', 'project', 'proj-nextspark-001', 'all_time', NOW() - INTERVAL '30 days'),
  ('ue-nextspark-002', 'sub-nextspark-001', 'test-superadmin-001', 'team-nextspark-001', 'api_calls', 200, 'api_batch', 'api_request', NULL, '2024-12', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- NEW TEAMS SUBSCRIPTIONS (10 teams from 090_sample_data.sql)
-- ============================================
-- Teams 1-8: Active subscriptions with 6 months payment history
-- Team 9 (Iota): Voluntary cancellation
-- Team 10 (Kappa): Payment failure cancellation

INSERT INTO public."subscriptions" (
  id,
  "teamId",
  "planId",
  status,
  "currentPeriodStart",
  "currentPeriodEnd",
  "billingInterval",
  "paymentProvider",
  "externalSubscriptionId",
  "externalCustomerId",
  "createdAt",
  "canceledAt",
  metadata
) VALUES
  -- Alpha Tech → Pro Plan (active, $29/mo)
  (
    'sub-alpha-001',
    'team-alpha-001',
    'plan_pro',
    'active',
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '30 days',
    'monthly',
    'stripe',
    'sub_alpha_stripe_001',
    'cus_alpha_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Beta Solutions → Pro Plan (active, $29/mo)
  (
    'sub-beta-001',
    'team-beta-002',
    'plan_pro',
    'active',
    NOW() - INTERVAL '25 days',
    NOW() + INTERVAL '5 days',
    'monthly',
    'stripe',
    'sub_beta_stripe_001',
    'cus_beta_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Gamma Industries → Pro Plan (active, $29/mo)
  (
    'sub-gamma-001',
    'team-gamma-003',
    'plan_pro',
    'active',
    NOW() - INTERVAL '20 days',
    NOW() + INTERVAL '10 days',
    'monthly',
    'stripe',
    'sub_gamma_stripe_001',
    'cus_gamma_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Delta Dynamics → Pro Plan (active, $29/mo)
  (
    'sub-delta-001',
    'team-delta-004',
    'plan_pro',
    'active',
    NOW() - INTERVAL '15 days',
    NOW() + INTERVAL '15 days',
    'monthly',
    'stripe',
    'sub_delta_stripe_001',
    'cus_delta_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Epsilon Media → Pro Plan (active, $29/mo)
  (
    'sub-epsilon-001',
    'team-epsilon-005',
    'plan_pro',
    'active',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '20 days',
    'monthly',
    'stripe',
    'sub_epsilon_stripe_001',
    'cus_epsilon_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Zeta Finance → Pro Plan (active, $29/mo)
  (
    'sub-zeta-001',
    'team-zeta-006',
    'plan_pro',
    'active',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '25 days',
    'monthly',
    'stripe',
    'sub_zeta_stripe_001',
    'cus_zeta_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Eta Healthcare → Pro Plan (active, $29/mo)
  (
    'sub-eta-001',
    'team-eta-007',
    'plan_pro',
    'active',
    NOW() - INTERVAL '28 days',
    NOW() + INTERVAL '2 days',
    'monthly',
    'stripe',
    'sub_eta_stripe_001',
    'cus_eta_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Theta Enterprises → Enterprise Plan (active, $499/mo)
  (
    'sub-theta-001',
    'team-theta-008',
    'plan_enterprise',
    'active',
    NOW() - INTERVAL '22 days',
    NOW() + INTERVAL '8 days',
    'monthly',
    'stripe',
    'sub_theta_stripe_001',
    'cus_theta_001',
    NOW() - INTERVAL '180 days',
    NULL,
    '{}'::jsonb
  ),
  -- Iota Consulting → Pro Plan (CANCELED - voluntary)
  (
    'sub-iota-001',
    'team-iota-009',
    'plan_pro',
    'canceled',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '15 days',
    'monthly',
    'stripe',
    'sub_iota_stripe_001',
    'cus_iota_001',
    NOW() - INTERVAL '180 days',
    NOW() - INTERVAL '15 days',
    '{"cancelReason": "voluntary", "canceledBy": "user"}'::jsonb
  ),
  -- Kappa Labs → Pro Plan (CANCELED - payment failure)
  (
    'sub-kappa-001',
    'team-kappa-010',
    'plan_pro',
    'canceled',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '10 days',
    'monthly',
    'stripe',
    'sub_kappa_stripe_001',
    'cus_kappa_001',
    NOW() - INTERVAL '180 days',
    NOW() - INTERVAL '10 days',
    '{"cancelReason": "payment_failed", "failedAttempts": 4}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- NEW TEAMS BILLING EVENTS (6 months history each)
-- ============================================
-- All amounts in cents (2900 = $29, 49900 = $499)

INSERT INTO public."billing_events" (
  id,
  "subscriptionId",
  type,
  status,
  amount,
  currency,
  "externalPaymentId",
  "createdAt"
) VALUES
  -- ========================================
  -- ALPHA TECH - 6 months payment history
  -- ========================================
  ('be-alpha-m1', 'sub-alpha-001', 'payment', 'succeeded', 2900, 'usd', 'pi_alpha_m1', NOW() - INTERVAL '180 days'),
  ('be-alpha-m2', 'sub-alpha-001', 'payment', 'succeeded', 2900, 'usd', 'pi_alpha_m2', NOW() - INTERVAL '150 days'),
  ('be-alpha-m3', 'sub-alpha-001', 'payment', 'succeeded', 2900, 'usd', 'pi_alpha_m3', NOW() - INTERVAL '120 days'),
  ('be-alpha-m4', 'sub-alpha-001', 'payment', 'succeeded', 2900, 'usd', 'pi_alpha_m4', NOW() - INTERVAL '90 days'),
  ('be-alpha-m5', 'sub-alpha-001', 'payment', 'succeeded', 2900, 'usd', 'pi_alpha_m5', NOW() - INTERVAL '60 days'),
  ('be-alpha-m6', 'sub-alpha-001', 'payment', 'succeeded', 2900, 'usd', 'pi_alpha_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- BETA SOLUTIONS - 6 months payment history
  -- ========================================
  ('be-beta-m1', 'sub-beta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_beta_m1', NOW() - INTERVAL '180 days'),
  ('be-beta-m2', 'sub-beta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_beta_m2', NOW() - INTERVAL '150 days'),
  ('be-beta-m3', 'sub-beta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_beta_m3', NOW() - INTERVAL '120 days'),
  ('be-beta-m4', 'sub-beta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_beta_m4', NOW() - INTERVAL '90 days'),
  ('be-beta-m5', 'sub-beta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_beta_m5', NOW() - INTERVAL '60 days'),
  ('be-beta-m6', 'sub-beta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_beta_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- GAMMA INDUSTRIES - 6 months payment history
  -- ========================================
  ('be-gamma-m1', 'sub-gamma-001', 'payment', 'succeeded', 2900, 'usd', 'pi_gamma_m1', NOW() - INTERVAL '180 days'),
  ('be-gamma-m2', 'sub-gamma-001', 'payment', 'succeeded', 2900, 'usd', 'pi_gamma_m2', NOW() - INTERVAL '150 days'),
  ('be-gamma-m3', 'sub-gamma-001', 'payment', 'succeeded', 2900, 'usd', 'pi_gamma_m3', NOW() - INTERVAL '120 days'),
  ('be-gamma-m4', 'sub-gamma-001', 'payment', 'succeeded', 2900, 'usd', 'pi_gamma_m4', NOW() - INTERVAL '90 days'),
  ('be-gamma-m5', 'sub-gamma-001', 'payment', 'succeeded', 2900, 'usd', 'pi_gamma_m5', NOW() - INTERVAL '60 days'),
  ('be-gamma-m6', 'sub-gamma-001', 'payment', 'succeeded', 2900, 'usd', 'pi_gamma_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- DELTA DYNAMICS - 6 months payment history
  -- ========================================
  ('be-delta-m1', 'sub-delta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_delta_m1', NOW() - INTERVAL '180 days'),
  ('be-delta-m2', 'sub-delta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_delta_m2', NOW() - INTERVAL '150 days'),
  ('be-delta-m3', 'sub-delta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_delta_m3', NOW() - INTERVAL '120 days'),
  ('be-delta-m4', 'sub-delta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_delta_m4', NOW() - INTERVAL '90 days'),
  ('be-delta-m5', 'sub-delta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_delta_m5', NOW() - INTERVAL '60 days'),
  ('be-delta-m6', 'sub-delta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_delta_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- EPSILON MEDIA - 6 months payment history
  -- ========================================
  ('be-epsilon-m1', 'sub-epsilon-001', 'payment', 'succeeded', 2900, 'usd', 'pi_epsilon_m1', NOW() - INTERVAL '180 days'),
  ('be-epsilon-m2', 'sub-epsilon-001', 'payment', 'succeeded', 2900, 'usd', 'pi_epsilon_m2', NOW() - INTERVAL '150 days'),
  ('be-epsilon-m3', 'sub-epsilon-001', 'payment', 'succeeded', 2900, 'usd', 'pi_epsilon_m3', NOW() - INTERVAL '120 days'),
  ('be-epsilon-m4', 'sub-epsilon-001', 'payment', 'succeeded', 2900, 'usd', 'pi_epsilon_m4', NOW() - INTERVAL '90 days'),
  ('be-epsilon-m5', 'sub-epsilon-001', 'payment', 'succeeded', 2900, 'usd', 'pi_epsilon_m5', NOW() - INTERVAL '60 days'),
  ('be-epsilon-m6', 'sub-epsilon-001', 'payment', 'succeeded', 2900, 'usd', 'pi_epsilon_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- ZETA FINANCE - 6 months payment history
  -- ========================================
  ('be-zeta-m1', 'sub-zeta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_zeta_m1', NOW() - INTERVAL '180 days'),
  ('be-zeta-m2', 'sub-zeta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_zeta_m2', NOW() - INTERVAL '150 days'),
  ('be-zeta-m3', 'sub-zeta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_zeta_m3', NOW() - INTERVAL '120 days'),
  ('be-zeta-m4', 'sub-zeta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_zeta_m4', NOW() - INTERVAL '90 days'),
  ('be-zeta-m5', 'sub-zeta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_zeta_m5', NOW() - INTERVAL '60 days'),
  ('be-zeta-m6', 'sub-zeta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_zeta_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- ETA HEALTHCARE - 6 months payment history
  -- ========================================
  ('be-eta-m1', 'sub-eta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_eta_m1', NOW() - INTERVAL '180 days'),
  ('be-eta-m2', 'sub-eta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_eta_m2', NOW() - INTERVAL '150 days'),
  ('be-eta-m3', 'sub-eta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_eta_m3', NOW() - INTERVAL '120 days'),
  ('be-eta-m4', 'sub-eta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_eta_m4', NOW() - INTERVAL '90 days'),
  ('be-eta-m5', 'sub-eta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_eta_m5', NOW() - INTERVAL '60 days'),
  ('be-eta-m6', 'sub-eta-001', 'payment', 'succeeded', 2900, 'usd', 'pi_eta_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- THETA ENTERPRISES - 6 months Enterprise @ $499/mo
  -- ========================================
  ('be-theta-m1', 'sub-theta-001', 'payment', 'succeeded', 49900, 'usd', 'pi_theta_m1', NOW() - INTERVAL '180 days'),
  ('be-theta-m2', 'sub-theta-001', 'payment', 'succeeded', 49900, 'usd', 'pi_theta_m2', NOW() - INTERVAL '150 days'),
  ('be-theta-m3', 'sub-theta-001', 'payment', 'succeeded', 49900, 'usd', 'pi_theta_m3', NOW() - INTERVAL '120 days'),
  ('be-theta-m4', 'sub-theta-001', 'payment', 'succeeded', 49900, 'usd', 'pi_theta_m4', NOW() - INTERVAL '90 days'),
  ('be-theta-m5', 'sub-theta-001', 'payment', 'succeeded', 49900, 'usd', 'pi_theta_m5', NOW() - INTERVAL '60 days'),
  ('be-theta-m6', 'sub-theta-001', 'payment', 'succeeded', 49900, 'usd', 'pi_theta_m6', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- IOTA CONSULTING - 5 months paid, then VOLUNTARY CANCELLATION
  -- ========================================
  ('be-iota-m1', 'sub-iota-001', 'payment', 'succeeded', 2900, 'usd', 'pi_iota_m1', NOW() - INTERVAL '180 days'),
  ('be-iota-m2', 'sub-iota-001', 'payment', 'succeeded', 2900, 'usd', 'pi_iota_m2', NOW() - INTERVAL '150 days'),
  ('be-iota-m3', 'sub-iota-001', 'payment', 'succeeded', 2900, 'usd', 'pi_iota_m3', NOW() - INTERVAL '120 days'),
  ('be-iota-m4', 'sub-iota-001', 'payment', 'succeeded', 2900, 'usd', 'pi_iota_m4', NOW() - INTERVAL '90 days'),
  ('be-iota-m5', 'sub-iota-001', 'payment', 'succeeded', 2900, 'usd', 'pi_iota_m5', NOW() - INTERVAL '60 days'),
  -- Last invoice before voluntary cancellation
  ('be-iota-inv-last', 'sub-iota-001', 'invoice', 'succeeded', 2900, 'usd', 'in_iota_last', NOW() - INTERVAL '30 days'),

  -- ========================================
  -- KAPPA LABS - 4 months paid, 2 failed payments, then CANCELED
  -- ========================================
  ('be-kappa-m1', 'sub-kappa-001', 'payment', 'succeeded', 2900, 'usd', 'pi_kappa_m1', NOW() - INTERVAL '180 days'),
  ('be-kappa-m2', 'sub-kappa-001', 'payment', 'succeeded', 2900, 'usd', 'pi_kappa_m2', NOW() - INTERVAL '150 days'),
  ('be-kappa-m3', 'sub-kappa-001', 'payment', 'succeeded', 2900, 'usd', 'pi_kappa_m3', NOW() - INTERVAL '120 days'),
  ('be-kappa-m4', 'sub-kappa-001', 'payment', 'succeeded', 2900, 'usd', 'pi_kappa_m4', NOW() - INTERVAL '90 days'),
  -- First failed payment attempt
  ('be-kappa-fail1', 'sub-kappa-001', 'payment', 'failed', 2900, 'usd', 'pi_kappa_fail1', NOW() - INTERVAL '60 days'),
  -- Retry failed payment
  ('be-kappa-fail2', 'sub-kappa-001', 'payment', 'failed', 2900, 'usd', 'pi_kappa_fail2', NOW() - INTERVAL '50 days'),
  -- Second failed payment (next month)
  ('be-kappa-fail3', 'sub-kappa-001', 'payment', 'failed', 2900, 'usd', 'pi_kappa_fail3', NOW() - INTERVAL '30 days'),
  -- Final attempt failed, subscription canceled
  ('be-kappa-fail4', 'sub-kappa-001', 'payment', 'failed', 2900, 'usd', 'pi_kappa_fail4', NOW() - INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ANNUAL SUBSCRIPTION TEAMS (5 teams)
-- ============================================
-- Teams 11-13: Enterprise Yearly ($4,990/yr = 499000 cents)
-- Teams 14-15: Pro Yearly ($290/yr = 29000 cents)

INSERT INTO public."subscriptions" (
  id,
  "teamId",
  "planId",
  status,
  "currentPeriodStart",
  "currentPeriodEnd",
  "billingInterval",
  "paymentProvider",
  "externalSubscriptionId",
  "externalCustomerId",
  "createdAt",
  metadata
) VALUES
  -- Lambda Corp → Enterprise Plan (active, yearly $4,990/yr)
  (
    'sub-lambda-001',
    'team-lambda-011',
    'plan_enterprise',
    'active',
    NOW() - INTERVAL '60 days',
    NOW() + INTERVAL '305 days',
    'yearly',
    'stripe',
    'sub_lambda_stripe_001',
    'cus_lambda_001',
    NOW() - INTERVAL '365 days',
    '{}'::jsonb
  ),
  -- Mu Industries → Enterprise Plan (active, yearly $4,990/yr)
  (
    'sub-mu-001',
    'team-mu-012',
    'plan_enterprise',
    'active',
    NOW() - INTERVAL '90 days',
    NOW() + INTERVAL '275 days',
    'yearly',
    'stripe',
    'sub_mu_stripe_001',
    'cus_mu_001',
    NOW() - INTERVAL '365 days',
    '{}'::jsonb
  ),
  -- Nu Dynamics → Enterprise Plan (active, yearly $4,990/yr)
  (
    'sub-nu-001',
    'team-nu-013',
    'plan_enterprise',
    'active',
    NOW() - INTERVAL '120 days',
    NOW() + INTERVAL '245 days',
    'yearly',
    'stripe',
    'sub_nu_stripe_001',
    'cus_nu_001',
    NOW() - INTERVAL '365 days',
    '{}'::jsonb
  ),
  -- Xi Solutions → Pro Plan (active, yearly $290/yr)
  (
    'sub-xi-001',
    'team-xi-014',
    'plan_pro',
    'active',
    NOW() - INTERVAL '45 days',
    NOW() + INTERVAL '320 days',
    'yearly',
    'stripe',
    'sub_xi_stripe_001',
    'cus_xi_001',
    NOW() - INTERVAL '365 days',
    '{}'::jsonb
  ),
  -- Omicron Labs → Pro Plan (active, yearly $290/yr)
  (
    'sub-omicron-001',
    'team-omicron-015',
    'plan_pro',
    'active',
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '335 days',
    'yearly',
    'stripe',
    'sub_omicron_stripe_001',
    'cus_omicron_001',
    NOW() - INTERVAL '365 days',
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ANNUAL BILLING EVENTS (1 year payment each)
-- ============================================
INSERT INTO public."billing_events" (
  id,
  "subscriptionId",
  type,
  status,
  amount,
  currency,
  "externalPaymentId",
  "createdAt"
) VALUES
  -- Lambda Corp - 1 yearly payment
  ('be-lambda-y1', 'sub-lambda-001', 'payment', 'succeeded', 499000, 'usd', 'pi_lambda_y1', NOW() - INTERVAL '60 days'),

  -- Mu Industries - 1 yearly payment
  ('be-mu-y1', 'sub-mu-001', 'payment', 'succeeded', 499000, 'usd', 'pi_mu_y1', NOW() - INTERVAL '90 days'),

  -- Nu Dynamics - 1 yearly payment
  ('be-nu-y1', 'sub-nu-001', 'payment', 'succeeded', 499000, 'usd', 'pi_nu_y1', NOW() - INTERVAL '120 days'),

  -- Xi Solutions - 1 yearly payment (Pro)
  ('be-xi-y1', 'sub-xi-001', 'payment', 'succeeded', 29000, 'usd', 'pi_xi_y1', NOW() - INTERVAL '45 days'),

  -- Omicron Labs - 1 yearly payment (Pro)
  ('be-omicron-y1', 'sub-omicron-001', 'payment', 'succeeded', 29000, 'usd', 'pi_omicron_y1', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;
