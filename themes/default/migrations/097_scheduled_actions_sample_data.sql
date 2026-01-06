-- Migration: 097_scheduled_actions_sample_data.sql
-- Description: Sample data for scheduled actions (webhooks and billing renewals)
-- Date: 2025-12-30

-- ============================================
-- SAMPLE SCHEDULED ACTIONS
-- ============================================

-- Completed webhook actions (task created events)
INSERT INTO public."scheduled_actions" (
  id, "teamId", "actionType", status, payload, "scheduledAt", "startedAt", "completedAt", attempts, "createdAt", "updatedAt"
) VALUES
-- Webhook for task creation - completed successfully
(
  'sa-webhook-001',
  'team-nextspark-001',
  'webhook:send',
  'completed',
  '{"eventType": "create", "entityType": "task", "entityId": "task-sample-001", "data": {"title": "Review Q4 Report", "status": "in_progress"}}',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '1 second',
  NOW() - INTERVAL '2 days' + INTERVAL '3 seconds',
  1,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '3 seconds'
),
-- Webhook for task update - completed
(
  'sa-webhook-002',
  'team-nextspark-001',
  'webhook:send',
  'completed',
  '{"eventType": "update", "entityType": "task", "entityId": "task-sample-001", "changes": {"status": "completed"}}',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day' + INTERVAL '2 seconds',
  NOW() - INTERVAL '1 day' + INTERVAL '4 seconds',
  1,
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day' + INTERVAL '4 seconds'
),
-- Webhook that failed (endpoint unreachable)
(
  'sa-webhook-003',
  'team-nextspark-001',
  'webhook:send',
  'failed',
  '{"eventType": "create", "entityType": "task", "entityId": "task-sample-002", "data": {"title": "Setup CI/CD"}}',
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '12 hours' + INTERVAL '1 second',
  NOW() - INTERVAL '12 hours' + INTERVAL '30 seconds',
  3,
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '12 hours' + INTERVAL '30 seconds'
)
ON CONFLICT (id) DO NOTHING;

-- Update error message separately (cleaner SQL)
UPDATE public."scheduled_actions"
SET "errorMessage" = 'Failed after 3 attempts: ECONNREFUSED - Webhook endpoint not reachable'
WHERE id = 'sa-webhook-003';

-- Completed billing renewal checks
INSERT INTO public."scheduled_actions" (
  id, "teamId", "actionType", status, payload, "scheduledAt", "startedAt", "completedAt", attempts, "recurringInterval", "createdAt", "updatedAt"
) VALUES
-- Daily billing check - 3 days ago
(
  'sa-billing-001',
  NULL,
  'billing:check-renewals',
  'completed',
  '{"processedTeams": 5, "renewalsTriggered": 1, "expirationsProcessed": 0}',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days' + INTERVAL '1 second',
  NOW() - INTERVAL '3 days' + INTERVAL '15 seconds',
  1,
  'daily',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days' + INTERVAL '15 seconds'
),
-- Daily billing check - 2 days ago
(
  'sa-billing-002',
  NULL,
  'billing:check-renewals',
  'completed',
  '{"processedTeams": 5, "renewalsTriggered": 0, "expirationsProcessed": 1}',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '1 second',
  NOW() - INTERVAL '2 days' + INTERVAL '12 seconds',
  1,
  'daily',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '12 seconds'
),
-- Daily billing check - yesterday
(
  'sa-billing-003',
  NULL,
  'billing:check-renewals',
  'completed',
  '{"processedTeams": 5, "renewalsTriggered": 2, "expirationsProcessed": 0}',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day' + INTERVAL '1 second',
  NOW() - INTERVAL '1 day' + INTERVAL '18 seconds',
  1,
  'daily',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day' + INTERVAL '18 seconds'
)
ON CONFLICT (id) DO NOTHING;
