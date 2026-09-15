-- Migration: 090_billing_sample_data.sql
-- Description: Sample billing plans for the blog theme (free, pro, enterprise)
-- Theme: blog
-- Phase: Theme sample data - runs before 999_theme_sample_data.sql, whose
--        subscriptions reference these plans by slug.
--
-- Mirrors themes/blog/config/billing.config.ts (slugs, prices, features,
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
  'plan_blog_free',
  'free',
  'Free',
  'Free plan to get started',
  'free',
  'public',
  0,
  0,
  0,
  '["basic_analytics"]'::jsonb,
  '{"posts": 10, "monthly_views": 10000, "storage_gb": 1, "authors": 1}'::jsonb,
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
  'plan_blog_pro',
  'pro',
  'Pro',
  'Professional plan for bloggers',
  'paid',
  'public',
  2900,
  29000,
  14,
  '["basic_analytics", "custom_domain", "advanced_seo"]'::jsonb,
  '{"posts": -1, "monthly_views": 100000, "storage_gb": 10, "authors": 5}'::jsonb,
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
  'plan_blog_enterprise',
  'enterprise',
  'Enterprise',
  'Custom enterprise plan with unlimited features',
  'enterprise',
  'hidden',
  NULL,
  NULL,
  30,
  '["*"]'::jsonb,
  '{"posts": -1, "monthly_views": -1, "storage_gb": -1, "authors": -1}'::jsonb,
  3
) ON CONFLICT (slug) DO NOTHING;
