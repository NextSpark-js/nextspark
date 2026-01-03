-- Migration: 003_sample_data_tasks.sql
-- Description: Sample data for tasks with team isolation
-- Date: 2025-11-26
-- Note: teamId references teams created in 013_sample_data.sql

-- ============================================
-- SAMPLE TASKS
-- ============================================
INSERT INTO public."tasks" (
  id,
  "userId",
  "teamId",
  title,
  description,
  completed,
  "createdAt",
  "updatedAt"
) VALUES
  -- ========================================
  -- CYPRESS TEST TASKS
  -- ========================================
  -- Personal Team tasks (user@cypress.com)
  (
    'task-cypress-001',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Implement user authentication system',
    'Create a complete user authentication system with login, registration, password reset, and email verification functionality using Better Auth.',
    false,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-cypress-002',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Design responsive dashboard layout',
    'Create a responsive dashboard layout with sidebar navigation, header with user menu, and main content area that works on desktop and mobile devices.',
    true,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '2 days'
  ),
  -- Acme Corporation tasks (Cypress Work Team)
  (
    'task-acme-001',
    'test-member-cypress-001',
    'team-work-acme-001',
    'Set up CI/CD pipeline for Acme',
    'Configure automated testing and deployment pipeline using GitHub Actions.',
    false,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-acme-002',
    'test-member-cypress-002',
    'team-work-acme-001',
    'Code review checklist',
    'Create and maintain a comprehensive code review checklist for the team.',
    false,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  ),

  -- ========================================
  -- EVERPOINT LABS TASKS (Technology Company)
  -- ========================================
  (
    'task-everpoint-001',
    'usr-carlos-001',
    'team-everpoint-001',
    'Design new microservices architecture',
    'Create architecture documentation for migrating monolith to microservices. Include service boundaries, communication patterns, and deployment strategy.',
    false,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'task-everpoint-002',
    'usr-james-002',
    'team-everpoint-001',
    'Implement API gateway',
    'Set up Kong or AWS API Gateway for routing, rate limiting, and authentication across microservices.',
    false,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-everpoint-003',
    'usr-emily-006',
    'team-everpoint-001',
    'Create design system documentation',
    'Document all UI components, design tokens, and usage guidelines for the team.',
    true,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'task-everpoint-004',
    'usr-diego-003',
    'team-everpoint-001',
    'Set up monitoring and alerting',
    'Configure Prometheus, Grafana, and PagerDuty for production monitoring.',
    false,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 day'
  ),

  -- ========================================
  -- IRONVALE GLOBAL TASKS (Consulting Firm)
  -- ========================================
  (
    'task-ironvale-001',
    'usr-ana-005',
    'team-ironvale-002',
    'Q4 Strategy presentation',
    'Prepare quarterly strategy presentation for the board meeting. Include market analysis and growth projections.',
    false,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-ironvale-002',
    'usr-sofia-007',
    'team-ironvale-002',
    'Client onboarding process review',
    'Review and optimize the client onboarding workflow. Identify bottlenecks and propose improvements.',
    true,
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    'task-ironvale-003',
    'usr-michael-004',
    'team-ironvale-002',
    'Market research for LATAM expansion',
    'Conduct market research for potential expansion into Latin American markets.',
    false,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-ironvale-004',
    'usr-sarah-008',
    'team-ironvale-002',
    'Competitor analysis report',
    'Compile comprehensive competitor analysis report for the consulting practice.',
    true,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '10 days'
  ),

  -- ========================================
  -- RIVERSTONE VENTURES TASKS (Investment Fund)
  -- ========================================
  (
    'task-riverstone-001',
    'usr-sofia-007',
    'team-riverstone-003',
    'Due diligence for TechStartup Inc.',
    'Complete financial and technical due diligence for potential Series A investment.',
    false,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-riverstone-002',
    'usr-emily-006',
    'team-riverstone-003',
    'Portfolio company quarterly reviews',
    'Schedule and prepare materials for Q4 portfolio company reviews.',
    false,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-riverstone-003',
    'usr-carlos-001',
    'team-riverstone-003',
    'Technical assessment framework',
    'Develop technical assessment framework for evaluating startup investments.',
    true,
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '4 days'
  ),

  -- ========================================
  -- PERSONAL TASKS (TMT.dev users)
  -- ========================================
  (
    'task-personal-carlos',
    'usr-carlos-001',
    'team-personal-carlos-001',
    'Update personal portfolio website',
    'Refresh portfolio with latest projects and update tech stack information.',
    false,
    NOW() - INTERVAL '2 days',
    NOW()
  ),
  (
    'task-personal-sofia',
    'usr-sofia-007',
    'team-personal-sofia-007',
    'Prepare conference talk',
    'Prepare slides and demo for upcoming tech conference presentation.',
    false,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE META DATA
-- ============================================
INSERT INTO public."tasks_metas" (
  "entityId",
  "metaKey",
  "metaValue",
  "dataType",
  "isPublic",
  "isSearchable"
) VALUES
  -- Everpoint Labs task metadata
  ('task-everpoint-001', 'priority', '"high"', 'string', true, true),
  ('task-everpoint-001', 'category', '"Architecture"', 'string', true, true),
  ('task-everpoint-002', 'priority', '"high"', 'string', true, true),
  ('task-everpoint-002', 'category', '"Backend"', 'string', true, true),
  ('task-everpoint-003', 'priority', '"medium"', 'string', true, true),
  ('task-everpoint-003', 'category', '"Design"', 'string', true, true),
  ('task-everpoint-004', 'priority', '"high"', 'string', true, true),
  ('task-everpoint-004', 'category', '"DevOps"', 'string', true, true),

  -- Ironvale Global task metadata
  ('task-ironvale-001', 'priority', '"critical"', 'string', true, true),
  ('task-ironvale-001', 'category', '"Strategy"', 'string', true, true),
  ('task-ironvale-002', 'priority', '"medium"', 'string', true, true),
  ('task-ironvale-002', 'category', '"Operations"', 'string', true, true),
  ('task-ironvale-003', 'priority', '"high"', 'string', true, true),
  ('task-ironvale-003', 'category', '"Research"', 'string', true, true),
  ('task-ironvale-004', 'priority', '"low"', 'string', true, true),
  ('task-ironvale-004', 'category', '"Research"', 'string', true, true),

  -- Riverstone Ventures task metadata
  ('task-riverstone-001', 'priority', '"critical"', 'string', true, true),
  ('task-riverstone-001', 'category', '"Due Diligence"', 'string', true, true),
  ('task-riverstone-002', 'priority', '"high"', 'string', true, true),
  ('task-riverstone-002', 'category', '"Portfolio Management"', 'string', true, true),
  ('task-riverstone-003', 'priority', '"medium"', 'string', true, true),
  ('task-riverstone-003', 'category', '"Process"', 'string', true, true)
ON CONFLICT ("entityId", "metaKey") DO NOTHING;
