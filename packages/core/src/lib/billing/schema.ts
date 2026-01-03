/**
 * Billing Validation Schemas
 *
 * Zod schemas for validating billing API inputs.
 * Used for type-safe API validation.
 */

import { z } from 'zod'

// ===========================================
// ENUM SCHEMAS
// ===========================================

export const planTypeSchema = z.enum(['free', 'paid', 'enterprise'])

export const planVisibilitySchema = z.enum(['public', 'hidden', 'invite_only'])

export const subscriptionStatusSchema = z.enum([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'paused',
  'expired',
])

export const paymentProviderSchema = z.enum(['stripe', 'paddle', 'lemonsqueezy'])

export const billingEventTypeSchema = z.enum(['payment', 'refund', 'invoice', 'credit'])

export const billingEventStatusSchema = z.enum(['pending', 'succeeded', 'failed'])

// ===========================================
// PLAN SCHEMAS
// ===========================================

export const createPlanSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: planTypeSchema.default('paid'),
  visibility: planVisibilitySchema.default('public'),
  priceMonthly: z.number().int().nonnegative().optional(),
  priceYearly: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).default('usd'),
  trialDays: z.number().int().nonnegative().default(0),
  features: z.array(z.string()).default([]),
  limits: z.record(z.string(), z.number().int()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().int().default(0),
})

export const updatePlanSchema = createPlanSchema.partial()

// ===========================================
// SUBSCRIPTION SCHEMAS
// ===========================================

export const createSubscriptionSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  userId: z.string().min(1, 'User ID is required').optional(),
  planId: z.string().min(1, 'Plan ID is required'),
  status: subscriptionStatusSchema.default('active'),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  trialEndsAt: z.string().datetime().optional(),
})

export const updateSubscriptionSchema = z.object({
  status: subscriptionStatusSchema.optional(),
  planId: z.string().min(1, 'Plan ID is required').optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
})

// ===========================================
// USAGE SCHEMAS
// ===========================================

export const trackUsageSchema = z.object({
  limitSlug: z.string().min(1),
  delta: z.number().int(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

// ===========================================
// BILLING EVENT SCHEMAS
// ===========================================

export const createBillingEventSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  type: billingEventTypeSchema,
  status: billingEventStatusSchema.default('pending'),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3).default('usd'),
  externalPaymentId: z.string().optional(),
  invoiceUrl: z.string().url().optional(),
  receiptUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

// ===========================================
// TYPE INFERENCE
// ===========================================

export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>
export type TrackUsageInput = z.infer<typeof trackUsageSchema>
export type CreateBillingEventInput = z.infer<typeof createBillingEventSchema>
