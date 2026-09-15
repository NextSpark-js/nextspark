-- Migration: 090_billing_sample_data.sql
-- Description: Sample billing plans for the productivity theme (free, pro, enterprise)
-- Theme: productivity
-- Phase: Theme sample data - runs before 999_theme_sample_data.sql, whose
--        subscriptions reference these plans by slug.
--
-- Mirrors themes/productivity/config/billing.config.ts (slugs, prices,
-- features, limits) so the seeded plans match what the app's billing config
-- declares.

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
  'plan_productivity_free',
  'free',
  'Free',
  'Free plan to get started',
  'free',
  'public',
  0,
  0,
  0,
  '["basic_analytics"]'::jsonb,
  '{"team_members": 3, "projects": 5, "tasks": 100, "workspaces": 1, "api_calls": 1000, "storage_gb": 2}'::jsonb,
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
  'plan_productivity_pro',
  'pro',
  'Pro',
  'Professional plan for project teams',
  'paid',
  'public',
  2900,
  29000,
  14,
  '["basic_analytics", "advanced_analytics", "api_access", "gantt_view", "time_tracking"]'::jsonb,
  '{"team_members": 15, "projects": 100, "tasks": -1, "workspaces": 5, "api_calls": 100000, "storage_gb": 50}'::jsonb,
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
  'plan_productivity_enterprise',
  'enterprise',
  'Enterprise',
  'Custom enterprise plan with unlimited features',
  'enterprise',
  'hidden',
  NULL,
  NULL,
  30,
  '["*"]'::jsonb,
  '{"team_members": -1, "projects": -1, "tasks": -1, "workspaces": -1, "api_calls": -1, "storage_gb": -1}'::jsonb,
  3
) ON CONFLICT (slug) DO NOTHING;
