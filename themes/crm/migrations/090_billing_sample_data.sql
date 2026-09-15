-- Migration: 090_billing_sample_data.sql
-- Description: Sample billing plans for the crm theme (free, pro, enterprise)
-- Theme: crm
-- Phase: Theme sample data - runs before 999_theme_sample_data.sql, whose
--        subscriptions reference these plans by slug.
--
-- Mirrors themes/crm/config/billing.config.ts (slugs, prices, features,
-- limits) so the seeded plans match what the app's billing config declares.

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
  'plan_crm_free',
  'free',
  'Free',
  'Free plan to get started',
  'free',
  'public',
  0,
  0,
  0,
  '["basic_analytics"]'::jsonb,
  '{"team_members": 2, "contacts": 100, "deals": 25, "pipelines": 1, "api_calls": 1000, "storage_gb": 1}'::jsonb,
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
  'plan_crm_pro',
  'pro',
  'Pro',
  'Professional plan for sales teams',
  'paid',
  'public',
  4900,
  49000,
  14,
  '["basic_analytics", "advanced_analytics", "api_access", "email_templates", "pipeline_automation"]'::jsonb,
  '{"team_members": 10, "contacts": 10000, "deals": 1000, "pipelines": 5, "api_calls": 100000, "storage_gb": 25}'::jsonb,
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
  'plan_crm_enterprise',
  'enterprise',
  'Enterprise',
  'Custom enterprise plan with unlimited features',
  'enterprise',
  'hidden',
  NULL,
  NULL,
  30,
  '["*"]'::jsonb,
  '{"team_members": -1, "contacts": -1, "deals": -1, "pipelines": -1, "api_calls": -1, "storage_gb": -1}'::jsonb,
  3
) ON CONFLICT (slug) DO NOTHING;
