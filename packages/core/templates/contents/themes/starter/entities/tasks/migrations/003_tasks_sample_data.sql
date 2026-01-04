-- Migration: 003_tasks_sample_data.sql
-- Description: Sample data for tasks - Starter Theme
-- Date: 2025-01-03
-- Note: teamId and userId references should match your seed data

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
  status,
  priority,
  tags,
  "dueDate",
  "estimatedHours",
  "createdAt",
  "updatedAt"
) VALUES
  -- ========================================
  -- SAMPLE TASKS FOR TESTING
  -- ========================================
  (
    'task-sample-001',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Set up project documentation',
    'Create comprehensive documentation for the project including README, API docs, and contribution guidelines.',
    false,
    'todo',
    'high',
    '["documentation", "setup"]'::jsonb,
    CURRENT_DATE + INTERVAL '7 days',
    4.0,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-sample-002',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Implement user authentication',
    'Set up authentication system with login, registration, and password recovery functionality.',
    false,
    'in-progress',
    'urgent',
    '["auth", "backend", "security"]'::jsonb,
    CURRENT_DATE + INTERVAL '3 days',
    8.0,
    NOW() - INTERVAL '5 days',
    NOW()
  ),
  (
    'task-sample-003',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Design dashboard layout',
    'Create responsive dashboard layout with sidebar navigation and main content area.',
    true,
    'done',
    'medium',
    '["design", "frontend", "ui"]'::jsonb,
    CURRENT_DATE - INTERVAL '2 days',
    6.0,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'task-sample-004',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Write unit tests',
    'Create comprehensive unit tests for all service layer functions.',
    false,
    'review',
    'high',
    '["testing", "quality"]'::jsonb,
    CURRENT_DATE + INTERVAL '5 days',
    10.0,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'task-sample-005',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Optimize database queries',
    'Review and optimize slow database queries. Add appropriate indexes.',
    false,
    'blocked',
    'medium',
    '["database", "performance", "optimization"]'::jsonb,
    CURRENT_DATE + INTERVAL '14 days',
    5.0,
    NOW() - INTERVAL '2 days',
    NOW()
  ),
  (
    'task-sample-006',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Set up CI/CD pipeline',
    'Configure automated testing and deployment using GitHub Actions.',
    false,
    'todo',
    'high',
    '["devops", "automation"]'::jsonb,
    CURRENT_DATE + INTERVAL '10 days',
    6.0,
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'task-sample-007',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Create API documentation',
    'Document all REST API endpoints with examples and response schemas.',
    true,
    'done',
    'low',
    '["documentation", "api"]'::jsonb,
    CURRENT_DATE - INTERVAL '5 days',
    3.0,
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'task-sample-008',
    'test-member-cypress-001',
    'team-personal-member-001',
    'Review code quality',
    'Perform code review and address any linting issues or code smells.',
    false,
    'in-progress',
    'medium',
    '["code-review", "quality"]'::jsonb,
    CURRENT_DATE + INTERVAL '2 days',
    4.0,
    NOW() - INTERVAL '3 days',
    NOW()
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
  -- Task metadata examples
  ('task-sample-001', 'category', '"Documentation"', 'string', true, true),
  ('task-sample-001', 'assignee', '"John Doe"', 'string', true, true),
  ('task-sample-002', 'category', '"Backend"', 'string', true, true),
  ('task-sample-002', 'complexity', '"high"', 'string', true, true),
  ('task-sample-003', 'category', '"Design"', 'string', true, true),
  ('task-sample-004', 'category', '"Testing"', 'string', true, true),
  ('task-sample-005', 'category', '"Database"', 'string', true, true),
  ('task-sample-005', 'blockedBy', '"Waiting for production access"', 'string', true, false),
  ('task-sample-006', 'category', '"DevOps"', 'string', true, true),
  ('task-sample-007', 'category', '"Documentation"', 'string', true, true),
  ('task-sample-008', 'category', '"Quality"', 'string', true, true)
ON CONFLICT ("entityId", "metaKey") DO NOTHING;
