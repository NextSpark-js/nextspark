import type { PaymentStatus } from './gateway'

/**
 * Which statuses a payment may reach each status from. Events arrive late and out of order, so an event that would
 * move a payment backwards (an old rejection after an approval, an approval after a refund) changes nothing.
 * `refunded` is final: nothing lists it as a source.
 */
export const PAYMENT_STATUS_SOURCES: Record<PaymentStatus, PaymentStatus[]> = {
  pending: [],
  succeeded: ['pending', 'failed', 'cancelled', 'disputed'],
  failed: ['pending'],
  cancelled: ['pending'],
  partially_refunded: ['pending', 'succeeded', 'partially_refunded', 'disputed'],
  refunded: ['pending', 'succeeded', 'partially_refunded', 'disputed'],
  disputed: ['pending', 'succeeded', 'partially_refunded'],
}
