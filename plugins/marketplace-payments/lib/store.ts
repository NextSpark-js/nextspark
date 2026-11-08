/**
 * The plugin's SQL. Two kinds of access, kept apart on purpose:
 * - reads a user asked for go through queryWithRLS with their id, so the database's policies decide what comes back;
 * - system paths (webhooks, scheduled actions, the writes of a route that already checked its permission) use the
 *   service connection, each statement scoped to its subject. Tokens are only ever read here, and only by a system path.
 */

import { createHash, randomBytes } from 'node:crypto'
import { query, queryOne, queryRows, queryWithRLS, withServiceTransaction } from '@nextsparkjs/core/lib/db'
import { tokenKeyring } from './env'
import { PAYMENT_STATUS_SOURCES } from './payment-status'
import {
  accessTokenContext,
  decryptToken,
  encryptToken,
  refreshTokenContext,
  type EncryptedCredential,
  type KeyRotationStore,
} from './token-crypto'
import type { AccountStatusResult, MarketplaceProvider, PaymentStatus, SellerStatus } from './gateway'
import type { MercadoPagoTokens } from './mercadopago/gateway'
import type { CredentialUpdate, LockedCredential, TokenRefreshStore } from './mercadopago/refresh'
import type { StoredPayment, WebhookStore } from './webhooks/handler'

const OAUTH_STATE_TTL_MINUTES = 10

/** The public shape of a seller account: never a token. */
export interface SellerAccount {
  id: string
  teamId: string
  provider: MarketplaceProvider
  providerAccountId: string
  status: SellerStatus
  chargesEnabled: boolean
  payoutsEnabled: boolean
  country: string | null
  createdAt: string
}

export interface PaymentRow {
  id: string
  provider: MarketplaceProvider
  amountCents: number
  commissionCents: number
  refundedCents: number
  currency: string
  description: string
  status: PaymentStatus
  createdAt: string
}

export class SellerAlreadyConnectedError extends Error {
  constructor() {
    super('This provider account is already connected to another team')
    this.name = 'SellerAlreadyConnectedError'
  }
}

const ACCOUNT_COLUMNS = `id, "teamId", provider, "providerAccountId", status, "chargesEnabled", "payoutsEnabled", country, "createdAt"`
const PAYMENT_COLUMNS = `id, provider, "amountCents"::float8 AS "amountCents", "commissionCents"::float8 AS "commissionCents", "refundedCents"::float8 AS "refundedCents", currency, description, status, "createdAt"`
const STORED_PAYMENT = `
  SELECT p.id, p.provider, p."accountId", a."providerAccountId", p."amountCents"::float8 AS "amountCents",
         p."commissionCents"::float8 AS "commissionCents", p.currency
  FROM public."marketplace_payments" p
  JOIN public."marketplace_accounts" a ON a.id = p."accountId"`

// ---------------------------------------------------------------------------
// What a signed-in user reads: RLS decides
// ---------------------------------------------------------------------------

export function listTeamAccounts(teamId: string, userId: string): Promise<SellerAccount[]> {
  return queryWithRLS<SellerAccount>(`SELECT ${ACCOUNT_COLUMNS} FROM public."marketplace_accounts" WHERE "teamId" = $1 ORDER BY provider`, [teamId], userId)
}

export async function listTeamPayments(teamId: string, userId: string, page: { limit: number; offset: number; status?: PaymentStatus }): Promise<{ payments: PaymentRow[]; total: number }> {
  const statusFilter = page.status ? ' AND status = $2' : ''
  const params = page.status ? [teamId, page.status] : [teamId]
  const payments = await queryWithRLS<PaymentRow>(
    `SELECT ${PAYMENT_COLUMNS} FROM public."marketplace_payments" WHERE "teamId" = $1${statusFilter}
     ORDER BY "createdAt" DESC LIMIT ${Number(page.limit)} OFFSET ${Number(page.offset)}`,
    params,
    userId
  )
  const [{ total }] = await queryWithRLS<{ total: number }>(`SELECT count(*)::int AS total FROM public."marketplace_payments" WHERE "teamId" = $1${statusFilter}`, params, userId)
  return { payments, total }
}

// ---------------------------------------------------------------------------
// Superadmin overview: the route checked the role
// ---------------------------------------------------------------------------

export interface MarketplaceOverview {
  totals: { provider: MarketplaceProvider; currency: string; payments: number; volumeCents: number; commissionCents: number }[]
  accountsByStatus: { status: SellerStatus; accounts: number }[]
  accounts: (SellerAccount & { teamName: string })[]
}

export async function marketplaceOverview(page: { limit: number; offset: number }): Promise<MarketplaceOverview> {
  const totals = await queryRows<MarketplaceOverview['totals'][number]>(
    `SELECT provider, currency, count(*)::int AS payments, sum("amountCents" - "refundedCents")::float8 AS "volumeCents", sum("commissionCents")::float8 AS "commissionCents"
     FROM public."marketplace_payments" WHERE status IN ('succeeded', 'partially_refunded', 'disputed')
     GROUP BY provider, currency ORDER BY provider, currency`
  )
  const accountsByStatus = await queryRows<MarketplaceOverview['accountsByStatus'][number]>(
    `SELECT status, count(*)::int AS accounts FROM public."marketplace_accounts" GROUP BY status ORDER BY status`
  )
  const accounts = await queryRows<SellerAccount & { teamName: string }>(
    `SELECT a.id, a."teamId", a.provider, a."providerAccountId", a.status, a."chargesEnabled", a."payoutsEnabled", a.country, a."createdAt", t.name AS "teamName"
     FROM public."marketplace_accounts" a JOIN public."teams" t ON t.id = a."teamId"
     ORDER BY a."createdAt" DESC LIMIT $1 OFFSET $2`,
    [page.limit, page.offset]
  )
  return { totals, accountsByStatus, accounts }
}

// ---------------------------------------------------------------------------
// Sellers
// ---------------------------------------------------------------------------

export function findAccount(teamId: string, provider: MarketplaceProvider): Promise<SellerAccount | null> {
  return queryOne<SellerAccount>(`SELECT ${ACCOUNT_COLUMNS} FROM public."marketplace_accounts" WHERE "teamId" = $1 AND provider = $2`, [teamId, provider])
}

/** Saves the seller of a team for a provider; a reconnection replaces the previous account. */
export async function upsertAccount(input: { teamId: string; provider: MarketplaceProvider; providerAccountId: string; status: SellerStatus; chargesEnabled: boolean; payoutsEnabled: boolean; country?: string }): Promise<string> {
  try {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO public."marketplace_accounts" ("teamId", provider, "providerAccountId", status, "chargesEnabled", "payoutsEnabled", country)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("teamId", provider) DO UPDATE SET
         "providerAccountId" = EXCLUDED."providerAccountId", status = EXCLUDED.status, "chargesEnabled" = EXCLUDED."chargesEnabled",
         "payoutsEnabled" = EXCLUDED."payoutsEnabled", country = COALESCE(EXCLUDED.country, public."marketplace_accounts".country), "updatedAt" = now()
       RETURNING id`,
      [input.teamId, input.provider, input.providerAccountId, input.status, input.chargesEnabled, input.payoutsEnabled, input.country ?? null]
    )
    return row!.id
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new SellerAlreadyConnectedError()
    throw error
  }
}

function encryptCredential(accountId: string, tokens: { accessToken: string; refreshToken: string }) {
  const keyring = tokenKeyring()
  return {
    accessTokenEnc: encryptToken(tokens.accessToken, keyring, accessTokenContext(accountId)),
    refreshTokenEnc: encryptToken(tokens.refreshToken, keyring, refreshTokenContext(accountId)),
  }
}

/** Saves a seller and its tokens in one transaction. */
export function saveMercadoPagoSeller(teamId: string, tokens: MercadoPagoTokens): Promise<string> {
  return withServiceTransaction(async () => {
    const accountId = await upsertAccount({ teamId, provider: 'mercadopago', providerAccountId: tokens.providerAccountId, status: 'active', chargesEnabled: true, payoutsEnabled: true })
    const { accessTokenEnc, refreshTokenEnc } = encryptCredential(accountId, tokens)
    await query(
      `INSERT INTO public."marketplace_seller_credentials" ("accountId", "accessTokenEnc", "refreshTokenEnc", "expiresAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("accountId") DO UPDATE SET "accessTokenEnc" = EXCLUDED."accessTokenEnc", "refreshTokenEnc" = EXCLUDED."refreshTokenEnc", "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = now()`,
      [accountId, accessTokenEnc, refreshTokenEnc, tokens.expiresAt]
    )
    return accountId
  })
}

export async function getSellerAccessToken(accountId: string): Promise<string | null> {
  const row = await queryOne<{ accessTokenEnc: string }>(`SELECT "accessTokenEnc" FROM public."marketplace_seller_credentials" WHERE "accountId" = $1`, [accountId])
  return row ? decryptToken(row.accessTokenEnc, tokenKeyring(), accessTokenContext(accountId)) : null
}

/** A disconnected seller keeps its row and its payments, and loses its tokens. One statement: atomic, in a webhook's transaction or alone. */
async function disconnect(where: string, params: unknown[]): Promise<void> {
  await query(
    `WITH disconnected AS (
       UPDATE public."marketplace_accounts" SET status = 'disconnected', "chargesEnabled" = false, "payoutsEnabled" = false, "updatedAt" = now()
       WHERE ${where} RETURNING id
     )
     DELETE FROM public."marketplace_seller_credentials" WHERE "accountId" IN (SELECT id FROM disconnected)`,
    params
  )
}

export const disconnectTeamSeller = (teamId: string, provider: MarketplaceProvider) => disconnect(`"teamId" = $1 AND provider = $2`, [teamId, provider])
const disconnectProviderSeller = (provider: MarketplaceProvider, providerAccountId: string) => disconnect(`provider = $1 AND "providerAccountId" = $2`, [provider, providerAccountId])

// ---------------------------------------------------------------------------
// OAuth state
// ---------------------------------------------------------------------------

const stateHash = (state: string) => createHash('sha256').update(state).digest('hex')

/** A fresh state for this user and team. Only its hash is stored. */
export async function createOAuthState(userId: string, teamId: string): Promise<string> {
  const state = randomBytes(32).toString('base64url')
  await query(`DELETE FROM public."marketplace_oauth_states" WHERE "userId" = $1 AND "expiresAt" < now()`, [userId])
  await query(
    `INSERT INTO public."marketplace_oauth_states" ("stateHash", "userId", "teamId", "expiresAt") VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [stateHash(state), userId, teamId, OAUTH_STATE_TTL_MINUTES]
  )
  return state
}

/** Spends a state: the team it was issued for, or null when it is unknown, expired, used or another user's. */
export async function consumeOAuthState(state: string, userId: string): Promise<string | null> {
  const row = await queryOne<{ teamId: string }>(
    `DELETE FROM public."marketplace_oauth_states" WHERE "stateHash" = $1 AND "userId" = $2 AND "expiresAt" > now() RETURNING "teamId"`,
    [stateHash(state), userId]
  )
  return row?.teamId ?? null
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function createPendingPayment(input: { teamId: string; accountId: string; provider: MarketplaceProvider; amountCents: number; commissionCents: number; currency: string; description: string }): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO public."marketplace_payments" ("teamId", "accountId", provider, "amountCents", "commissionCents", currency, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.teamId, input.accountId, input.provider, input.amountCents, input.commissionCents, input.currency.toUpperCase(), input.description]
  )
  return row!.id
}

export async function attachCheckout(paymentId: string, providerCheckoutId: string): Promise<void> {
  await query(`UPDATE public."marketplace_payments" SET "providerCheckoutId" = $2, "updatedAt" = now() WHERE id = $1`, [paymentId, providerCheckoutId])
}

export async function findPayment(id: string): Promise<StoredPayment | null> {
  return queryOne<StoredPayment>(`${STORED_PAYMENT} WHERE p.id = $1`, [id])
}

export async function getPaymentForRefund(id: string): Promise<(StoredPayment & { providerPaymentId: string | null }) | null> {
  return queryOne(`${STORED_PAYMENT.replace('p.currency', 'p.currency, p."providerPaymentId"')} WHERE p.id = $1`, [id])
}

export const webhookStore: WebhookStore = {
  findPayment,
  findPaymentByProviderPaymentId: (provider, providerPaymentId) =>
    queryOne<StoredPayment>(`${STORED_PAYMENT} WHERE p.provider = $1 AND p."providerPaymentId" = $2`, [provider, providerPaymentId]),

  async transitionPayment(id, status, fields = {}) {
    // the source check is in the UPDATE, so two concurrent events cannot both pass it
    await query(
      `UPDATE public."marketplace_payments"
       SET status = $2, "providerPaymentId" = COALESCE($3, "providerPaymentId"), "refundedCents" = GREATEST("refundedCents", COALESCE($4::bigint, 0)), "updatedAt" = now()
       WHERE id = $1 AND status = ANY($5::text[])`,
      [id, status, fields.providerPaymentId ?? null, fields.refundedCents ?? null, PAYMENT_STATUS_SOURCES[status]]
    )
  },

  async updateSellerStatus(provider, providerAccountId, status: AccountStatusResult) {
    await query(
      `UPDATE public."marketplace_accounts" SET status = $3, "chargesEnabled" = $4, "payoutsEnabled" = $5, country = COALESCE($6, country), "updatedAt" = now()
       WHERE provider = $1 AND "providerAccountId" = $2 AND status <> 'disconnected'`,
      [provider, providerAccountId, status.status, status.chargesEnabled, status.payoutsEnabled, status.country ?? null]
    )
  },

  disconnectSeller: disconnectProviderSeller,
  getSellerAccessToken,
}

// ---------------------------------------------------------------------------
// Scheduled actions
// ---------------------------------------------------------------------------

export const tokenRefreshStore: TokenRefreshStore = {
  async listMercadoPagoAccountsExpiringBefore(before, limit) {
    const rows = await queryRows<{ accountId: string }>(
      `SELECT c."accountId" FROM public."marketplace_seller_credentials" c
       JOIN public."marketplace_accounts" a ON a.id = c."accountId"
       WHERE a.provider = 'mercadopago' AND c."expiresAt" < $1 ORDER BY c."expiresAt" LIMIT $2`,
      [before, limit]
    )
    return rows.map(row => row.accountId)
  },

  async updateLockedCredential(accountId, decide: (current: LockedCredential) => Promise<CredentialUpdate>) {
    let revoked = false
    await withServiceTransaction(async () => {
      const row = await queryOne<{ refreshTokenEnc: string; expiresAt: Date }>(
        `SELECT "refreshTokenEnc", "expiresAt" FROM public."marketplace_seller_credentials" WHERE "accountId" = $1 FOR UPDATE SKIP LOCKED`,
        [accountId]
      )
      if (!row) return
      const update = await decide({ accountId, refreshToken: decryptToken(row.refreshTokenEnc, tokenKeyring(), refreshTokenContext(accountId)), expiresAt: row.expiresAt })
      if (update === 'revoked') {
        revoked = true
      } else if (update) {
        const { accessTokenEnc, refreshTokenEnc } = encryptCredential(accountId, update.tokens)
        await query(
          `UPDATE public."marketplace_seller_credentials" SET "accessTokenEnc" = $2, "refreshTokenEnc" = $3, "expiresAt" = $4, "updatedAt" = now() WHERE "accountId" = $1`,
          [accountId, accessTokenEnc, refreshTokenEnc, update.tokens.expiresAt]
        )
      }
    })
    if (revoked) await disconnect(`id = $1`, [accountId])
  },
}

export const keyRotationStore: KeyRotationStore = {
  async listCredentialsNotOnKey(keyId, after, limit) {
    const prefix = `v1.${keyId}.%`
    const rows = await queryRows<{ accountId: string }>(
      `SELECT "accountId" FROM public."marketplace_seller_credentials"
       WHERE ("accessTokenEnc" NOT LIKE $1 OR "refreshTokenEnc" NOT LIKE $1) AND ($2::text IS NULL OR "accountId" > $2)
       ORDER BY "accountId" LIMIT $3`,
      [prefix, after, limit]
    )
    return rows.map(row => row.accountId)
  },

  async rewriteLockedCredential(accountId, rewrite: (row: EncryptedCredential) => EncryptedCredential) {
    await withServiceTransaction(async () => {
      const row = await queryOne<EncryptedCredential>(
        `SELECT "accountId", "accessTokenEnc", "refreshTokenEnc" FROM public."marketplace_seller_credentials" WHERE "accountId" = $1 FOR UPDATE SKIP LOCKED`,
        [accountId]
      )
      if (!row) return
      const next = rewrite(row)
      await query(`UPDATE public."marketplace_seller_credentials" SET "accessTokenEnc" = $2, "refreshTokenEnc" = $3, "updatedAt" = now() WHERE "accountId" = $1`, [accountId, next.accessTokenEnc, next.refreshTokenEnc])
    })
  },
}
