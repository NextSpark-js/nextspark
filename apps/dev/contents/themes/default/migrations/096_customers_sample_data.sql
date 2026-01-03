-- Migration: 096_customers_sample_data.sql
-- Description: Demo customers for TMT.dev users and company teams
-- Date: 2025-12-24
-- Phase: Theme sample data - runs AFTER users/teams (090) and entity tables (001-002)
--
-- NOTE: This file contains demo customers for the default theme.
-- All customers reference users and teams from 090_demo_users_teams.sql

-- ============================================
-- EVERPOINT LABS CUSTOMERS (Technology Company)
-- ============================================
INSERT INTO public."customers" (
  id,
  "userId",
  "teamId",
  office,
  account,
  name,
  phone,
  "salesRep",
  "visitDays",
  "contactDays",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'customer-everpoint-001',
    'usr-carlos-001',
    'team-everpoint-001',
    'San Francisco',
    2001,
    'TechGiant Inc.',
    '+1 415 555 0101',
    'Carlos Mendoza',
    '["mon", "wed"]'::jsonb,
    '["tue", "fri"]'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'customer-everpoint-002',
    'usr-james-002',
    'team-everpoint-001',
    'Austin',
    2002,
    'StartupXYZ',
    '+1 512 555 0102',
    'James Wilson',
    '["tue", "thu"]'::jsonb,
    '["mon", "wed"]'::jsonb,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    'customer-everpoint-003',
    'usr-emily-006',
    'team-everpoint-001',
    'Seattle',
    2003,
    'CloudServices Pro',
    '+1 206 555 0103',
    'Emily Johnson',
    '["wed", "fri"]'::jsonb,
    '["mon", "thu"]'::jsonb,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'customer-everpoint-004',
    'usr-diego-003',
    'team-everpoint-001',
    'Mexico City',
    2004,
    'LatamTech Solutions',
    '+52 55 5555 0104',
    'Diego Ramirez',
    '["mon", "thu"]'::jsonb,
    '["wed", "fri"]'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW()
  ),

  -- ========================================
  -- IRONVALE GLOBAL CUSTOMERS (Consulting Firm)
  -- ========================================
  (
    'customer-ironvale-001',
    'usr-ana-005',
    'team-ironvale-002',
    'Madrid',
    3001,
    'European Holdings SA',
    '+34 91 555 0201',
    'Ana Garcia',
    '["mon", "wed", "fri"]'::jsonb,
    '["tue"]'::jsonb,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '10 days'
  ),
  (
    'customer-ironvale-002',
    'usr-sofia-007',
    'team-ironvale-002',
    'Buenos Aires',
    3002,
    'Grupo Inversiones Sur',
    '+54 11 5555 0202',
    'Sofia Lopez',
    '["tue", "thu"]'::jsonb,
    '["mon", "fri"]'::jsonb,
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'customer-ironvale-003',
    'usr-michael-004',
    'team-ironvale-002',
    'Los Angeles',
    3003,
    'West Coast Ventures LLC',
    '+1 310 555 0203',
    'Michael Brown',
    '["wed"]'::jsonb,
    '["mon", "thu"]'::jsonb,
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'customer-ironvale-004',
    'usr-ana-005',
    'team-ironvale-002',
    'Barcelona',
    3004,
    'Mediterranean Partners',
    '+34 93 555 0204',
    'Ana Garcia',
    '["mon", "fri"]'::jsonb,
    '["wed"]'::jsonb,
    NOW() - INTERVAL '12 days',
    NOW()
  ),

  -- ========================================
  -- RIVERSTONE VENTURES CUSTOMERS (Investment Fund)
  -- ========================================
  (
    'customer-riverstone-001',
    'usr-sofia-007',
    'team-riverstone-003',
    'New York',
    4001,
    'Horizon Capital Partners',
    '+1 212 555 0301',
    'Sofia Lopez',
    '["mon", "wed"]'::jsonb,
    '["tue", "thu"]'::jsonb,
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    'customer-riverstone-002',
    'usr-emily-006',
    'team-riverstone-003',
    'London',
    4002,
    'Atlantic Growth Fund',
    '+44 20 5555 0302',
    'Emily Johnson',
    '["tue", "fri"]'::jsonb,
    '["mon", "wed"]'::jsonb,
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    'customer-riverstone-003',
    'usr-carlos-001',
    'team-riverstone-003',
    'Singapore',
    4003,
    'Asia Pacific Investors',
    '+65 5555 0303',
    'Carlos Mendoza',
    '["wed", "thu"]'::jsonb,
    '["mon", "fri"]'::jsonb,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '1 day'
  ),

  -- ========================================
  -- PERSONAL CUSTOMERS (TMT.dev users)
  -- ========================================
  (
    'customer-personal-carlos',
    'usr-carlos-001',
    'team-personal-carlos-001',
    'Home Office',
    9001,
    'Freelance Client A',
    '+54 11 5555 9001',
    'Carlos Mendoza',
    '["fri"]'::jsonb,
    '["mon"]'::jsonb,
    NOW() - INTERVAL '5 days',
    NOW()
  ),
  (
    'customer-personal-ana',
    'usr-ana-005',
    'team-personal-ana-005',
    'Home Office',
    9002,
    'Side Project Client',
    '+34 91 555 9002',
    'Ana Garcia',
    '["sat"]'::jsonb,
    '["sun"]'::jsonb,
    NOW() - INTERVAL '3 days',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE META DATA
-- ============================================
INSERT INTO public."customers_metas" (
  "entityId",
  "metaKey",
  "metaValue",
  "dataType",
  "isPublic",
  "isSearchable"
) VALUES
  -- Everpoint Labs customer metadata
  (
    'customer-everpoint-001',
    'credit_limit',
    '{"amount": 500000, "currency": "USD"}',
    'object',
    false,
    false
  ),
  (
    'customer-everpoint-001',
    'industry',
    '"Enterprise Software"',
    'string',
    true,
    true
  ),
  (
    'customer-everpoint-002',
    'credit_limit',
    '{"amount": 100000, "currency": "USD"}',
    'object',
    false,
    false
  ),
  (
    'customer-everpoint-002',
    'industry',
    '"SaaS Startup"',
    'string',
    true,
    true
  ),
  (
    'customer-everpoint-003',
    'industry',
    '"Cloud Infrastructure"',
    'string',
    true,
    true
  ),
  (
    'customer-everpoint-004',
    'industry',
    '"Technology Services"',
    'string',
    true,
    true
  ),

  -- Ironvale Global customer metadata
  (
    'customer-ironvale-001',
    'contract_value',
    '{"amount": 2500000, "currency": "EUR"}',
    'object',
    false,
    false
  ),
  (
    'customer-ironvale-001',
    'industry',
    '"Financial Services"',
    'string',
    true,
    true
  ),
  (
    'customer-ironvale-002',
    'industry',
    '"Investment Management"',
    'string',
    true,
    true
  ),
  (
    'customer-ironvale-003',
    'industry',
    '"Private Equity"',
    'string',
    true,
    true
  ),
  (
    'customer-ironvale-004',
    'industry',
    '"Real Estate"',
    'string',
    true,
    true
  ),

  -- Riverstone Ventures customer metadata
  (
    'customer-riverstone-001',
    'aum',
    '{"amount": 500000000, "currency": "USD"}',
    'object',
    false,
    false
  ),
  (
    'customer-riverstone-001',
    'industry',
    '"Venture Capital"',
    'string',
    true,
    true
  ),
  (
    'customer-riverstone-002',
    'industry',
    '"Growth Equity"',
    'string',
    true,
    true
  ),
  (
    'customer-riverstone-003',
    'industry',
    '"Cross-border Investment"',
    'string',
    true,
    true
  )
ON CONFLICT ("entityId", "metaKey") DO NOTHING;
