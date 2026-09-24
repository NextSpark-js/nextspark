-- Migration: 095_tasks_sample_data.sql
-- Description: Demo tasks for TMT.dev users and company teams
-- Date: 2025-12-24
-- Phase: Theme sample data - runs AFTER users/teams (090) and entity tables (001-002)
--
-- NOTE: This file contains demo tasks for the default theme.
-- All tasks reference users and teams from 090_demo_users_teams.sql

-- ============================================
-- EVERPOINT LABS TASKS (Technology Company)
-- Carlos (owner) - Multiple tasks with varied statuses/priorities for filter testing
-- ============================================
INSERT INTO public."tasks" (
  id,
  "userId",
  "teamId",
  title,
  description,
  completed,
  status,
  priority,
  "dueDate",
  "createdAt",
  "updatedAt"
) VALUES
  -- Carlos - TODO tasks
  (
    'task-everpoint-001',
    'usr-carlos-001',
    'team-everpoint-001',
    'Design new microservices architecture',
    'Create architecture documentation for migrating monolith to microservices. Include service boundaries, communication patterns, and deployment strategy.',
    false,
    'todo',
    'urgent',
    NOW() + INTERVAL '3 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'task-everpoint-carlos-todo-high',
    'usr-carlos-001',
    'team-everpoint-001',
    'Review Q4 security audit findings',
    'Analyze security audit report and prioritize remediation tasks for the development team.',
    false,
    'todo',
    'high',
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-everpoint-carlos-todo-medium',
    'usr-carlos-001',
    'team-everpoint-001',
    'Update team onboarding documentation',
    'Refresh the technical onboarding guide with new tooling and processes.',
    false,
    'todo',
    'medium',
    NOW() + INTERVAL '14 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'task-everpoint-carlos-todo-low',
    'usr-carlos-001',
    'team-everpoint-001',
    'Organize tech debt backlog',
    'Review and categorize accumulated tech debt items for sprint planning.',
    false,
    'todo',
    'low',
    NOW() + INTERVAL '30 days',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '3 days'
  ),

  -- Carlos - IN-PROGRESS tasks
  (
    'task-everpoint-carlos-progress-urgent',
    'usr-carlos-001',
    'team-everpoint-001',
    'Fix critical production bug in payment service',
    'Users reporting failed transactions. Investigate and hotfix the payment processing module.',
    false,
    'in-progress',
    'urgent',
    NOW() + INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'task-everpoint-carlos-progress-high',
    'usr-carlos-001',
    'team-everpoint-001',
    'Implement OAuth2 integration',
    'Add Google and GitHub OAuth providers to the authentication system.',
    false,
    'in-progress',
    'high',
    NOW() + INTERVAL '5 days',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-everpoint-carlos-progress-medium',
    'usr-carlos-001',
    'team-everpoint-001',
    'Refactor database connection pooling',
    'Optimize connection pool settings and implement proper connection lifecycle management.',
    false,
    'in-progress',
    'medium',
    NOW() + INTERVAL '10 days',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '2 days'
  ),

  -- Carlos - REVIEW tasks
  (
    'task-everpoint-carlos-review-high',
    'usr-carlos-001',
    'team-everpoint-001',
    'Review infrastructure cost optimization PR',
    'Evaluate proposed changes to reduce AWS costs by 30%.',
    false,
    'review',
    'high',
    NOW() + INTERVAL '2 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-everpoint-carlos-review-medium',
    'usr-carlos-001',
    'team-everpoint-001',
    'QA new user dashboard features',
    'Test and provide feedback on the redesigned user dashboard before release.',
    false,
    'review',
    'medium',
    NOW() + INTERVAL '4 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 day'
  ),

  -- Carlos - DONE tasks
  (
    'task-everpoint-carlos-done-urgent',
    'usr-carlos-001',
    'team-everpoint-001',
    'Emergency database migration',
    'Completed urgent migration to fix data integrity issues in production.',
    true,
    'done',
    'urgent',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'task-everpoint-carlos-done-high',
    'usr-carlos-001',
    'team-everpoint-001',
    'Deploy new API versioning strategy',
    'Successfully implemented API v2 with backward compatibility.',
    true,
    'done',
    'high',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'task-everpoint-carlos-done-medium',
    'usr-carlos-001',
    'team-everpoint-001',
    'Set up staging environment',
    'Configured complete staging environment mirroring production.',
    true,
    'done',
    'medium',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '10 days'
  ),
  (
    'task-everpoint-carlos-done-low',
    'usr-carlos-001',
    'team-everpoint-001',
    'Archive old project repositories',
    'Cleaned up and archived deprecated project repositories.',
    true,
    'done',
    'low',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '7 days'
  ),

  -- Carlos - BLOCKED tasks
  (
    'task-everpoint-carlos-blocked-high',
    'usr-carlos-001',
    'team-everpoint-001',
    'Integrate third-party analytics SDK',
    'Blocked: Waiting for vendor to provide API credentials and documentation.',
    false,
    'blocked',
    'high',
    NOW() + INTERVAL '14 days',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-everpoint-carlos-blocked-medium',
    'usr-carlos-001',
    'team-everpoint-001',
    'Migrate to new CDN provider',
    'Blocked: Legal team reviewing new vendor contract terms.',
    false,
    'blocked',
    'medium',
    NOW() + INTERVAL '21 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '3 days'
  ),

  -- Other Everpoint team members
  (
    'task-everpoint-002',
    'usr-james-002',
    'team-everpoint-001',
    'Implement API gateway',
    'Set up Kong or AWS API Gateway for routing, rate limiting, and authentication across microservices.',
    false,
    'in-progress',
    'high',
    NOW() + INTERVAL '10 days',
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
    'done',
    'medium',
    NOW() - INTERVAL '3 days',
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
    'review',
    'high',
    NOW() + INTERVAL '5 days',
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
    'in-progress',
    'urgent',
    NOW() + INTERVAL '2 days',
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
    'done',
    'medium',
    NOW() - INTERVAL '5 days',
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
    'todo',
    'high',
    NOW() + INTERVAL '14 days',
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
    'done',
    'low',
    NOW() - INTERVAL '12 days',
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
    'in-progress',
    'urgent',
    NOW() + INTERVAL '5 days',
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
    'todo',
    'high',
    NOW() + INTERVAL '10 days',
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
    'done',
    'medium',
    NOW() - INTERVAL '7 days',
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
    'in-progress',
    'low',
    NOW() + INTERVAL '7 days',
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
    'review',
    'high',
    NOW() + INTERVAL '3 days',
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
