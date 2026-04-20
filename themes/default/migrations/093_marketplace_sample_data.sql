-- Migration: 093_marketplace_sample_data.sql
-- Description: Sample marketplace data - connected accounts, payments, and webhook events
-- Date: 2026-03-20
-- Theme: default
-- Phase: Theme sample data - runs AFTER 092_billing_sample_data.sql
--
-- This file contains marketplace sample data for:
-- - 7 connected accounts (Stripe Connect + MercadoPago, various statuses)
-- - 25 marketplace payments (various statuses, currencies, amounts)
-- - 12 webhook events (Stripe Connect + MercadoPago)
--
-- Uses teams from 090_demo_users_teams.sql and 091_greek_teams_billing.sql

-- ============================================
-- CONNECTED ACCOUNTS (7 accounts)
-- ============================================
-- 4 Stripe Connect accounts (active, in_progress, restricted, disconnected)
-- 3 MercadoPago accounts (active in AR, BR, MX)

INSERT INTO public."connectedAccounts" (
  id,
  "teamId",
  provider,
  "externalAccountId",
  email,
  "businessName",
  country,
  currency,
  "onboardingStatus",
  "chargesEnabled",
  "payoutsEnabled",
  "commissionRate",
  "fixedFee",
  "payoutSchedule",
  metadata,
  "createdAt",
  "updatedAt"
) VALUES
  -- ========================================
  -- STRIPE CONNECT ACCOUNTS
  -- ========================================

  -- Everpoint Labs → Stripe Connect (active, 15% commission)
  (
    'mkt-acct-everpoint-001',
    'team-everpoint-001',
    'stripe_connect',
    'acct_everpoint_stripe_001',
    'billing@everpointlabs.com',
    'Everpoint Labs LLC',
    'US',
    'usd',
    'active',
    TRUE,
    TRUE,
    0.1500,
    30,
    'weekly',
    '{"stripeAccountType": "express", "businessType": "company", "mcc": "5734"}'::jsonb,
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '2 days'
  ),

  -- Alpha Tech → Stripe Connect (active, 10% commission)
  (
    'mkt-acct-alpha-001',
    'team-alpha-001',
    'stripe_connect',
    'acct_alpha_stripe_001',
    'finance@alphatech.io',
    'Alpha Tech Inc.',
    'US',
    'usd',
    'active',
    TRUE,
    TRUE,
    0.1000,
    25,
    'daily',
    '{"stripeAccountType": "express", "businessType": "company", "mcc": "7372"}'::jsonb,
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '5 days'
  ),

  -- Beta Solutions → Stripe Connect (in_progress, 15% commission)
  (
    'mkt-acct-beta-001',
    'team-beta-002',
    'stripe_connect',
    'acct_beta_stripe_001',
    'admin@betasolutions.com',
    'Beta Solutions Corp.',
    'US',
    'usd',
    'in_progress',
    FALSE,
    FALSE,
    0.1500,
    30,
    'weekly',
    '{"stripeAccountType": "express", "businessType": "company", "pendingVerification": ["external_account", "identity_document"]}'::jsonb,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '1 day'
  ),

  -- Gamma Industries → Stripe Connect (restricted, 20% commission)
  (
    'mkt-acct-gamma-001',
    'team-gamma-003',
    'stripe_connect',
    'acct_gamma_stripe_001',
    'ops@gammaindustries.net',
    'Gamma Industries Ltd.',
    'GB',
    'gbp',
    'restricted',
    TRUE,
    FALSE,
    0.2000,
    50,
    'monthly',
    '{"stripeAccountType": "express", "businessType": "company", "restrictionReason": "past_due_requirements", "currentDeadline": "2026-04-15"}'::jsonb,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '3 days'
  ),

  -- ========================================
  -- MERCADOPAGO ACCOUNTS
  -- ========================================

  -- Ironvale Global → MercadoPago Argentina (active, 15% commission)
  (
    'mkt-acct-ironvale-001',
    'team-ironvale-002',
    'mercadopago_split',
    'mp_user_ironvale_ar_001',
    'pagos@ironvaleglobal.com.ar',
    'Ironvale Global SRL',
    'AR',
    'ars',
    'active',
    TRUE,
    TRUE,
    0.1500,
    0,
    'weekly',
    '{"mpUserId": "123456789", "mpAccessToken": "APP_USR-xxxx-redacted", "mpRefreshToken": "TG-xxxx-redacted", "mpTokenExpiresAt": "2026-06-20T00:00:00Z", "cuit": "30-71234567-8"}'::jsonb,
    NOW() - INTERVAL '75 days',
    NOW() - INTERVAL '1 day'
  ),

  -- Riverstone Ventures → MercadoPago Brazil (active, 10% commission)
  (
    'mkt-acct-riverstone-001',
    'team-riverstone-003',
    'mercadopago_split',
    'mp_user_riverstone_br_001',
    'financeiro@riverstonebr.com.br',
    'Riverstone Ventures Ltda.',
    'BR',
    'brl',
    'active',
    TRUE,
    TRUE,
    0.1000,
    0,
    'daily',
    '{"mpUserId": "987654321", "mpAccessToken": "APP_USR-yyyy-redacted", "mpRefreshToken": "TG-yyyy-redacted", "mpTokenExpiresAt": "2026-07-10T00:00:00Z", "cnpj": "12.345.678/0001-90"}'::jsonb,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '4 days'
  ),

  -- Delta Dynamics → MercadoPago Mexico (active, 20% commission)
  (
    'mkt-acct-delta-001',
    'team-delta-004',
    'mercadopago_split',
    'mp_user_delta_mx_001',
    'cobranza@deltadynamics.mx',
    'Delta Dynamics SA de CV',
    'MX',
    'mxn',
    'active',
    TRUE,
    TRUE,
    0.2000,
    0,
    'weekly',
    '{"mpUserId": "456789123", "mpAccessToken": "APP_USR-zzzz-redacted", "mpRefreshToken": "TG-zzzz-redacted", "mpTokenExpiresAt": "2026-05-30T00:00:00Z", "rfc": "DDY201501ABC"}'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '2 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MARKETPLACE PAYMENTS (25 payments)
-- ============================================
-- Mix of statuses, currencies, amounts, and commission rates

INSERT INTO public."marketplacePayments" (
  id,
  "connectedAccountId",
  "teamId",
  "referenceId",
  "referenceType",
  "externalPaymentId",
  "externalChargeId",
  "externalTransferId",
  "totalAmount",
  "applicationFee",
  "businessAmount",
  "providerFee",
  currency,
  "commissionRate",
  status,
  "statusDetail",
  "paymentMethod",
  "paymentType",
  "refundedAmount",
  metadata,
  "paidAt",
  "createdAt",
  "updatedAt"
) VALUES
  -- ========================================
  -- EVERPOINT LABS (Stripe Connect, USD, 15%)
  -- ========================================

  -- Succeeded payments
  (
    'mkt-pay-ever-001',
    'mkt-acct-everpoint-001',
    'team-everpoint-001',
    'booking-001',
    'booking',
    'pi_ever_mkt_001',
    'ch_ever_mkt_001',
    'tr_ever_mkt_001',
    25000,    -- $250.00
    3750,     -- $37.50 (15%)
    21250,    -- $212.50
    725,      -- Stripe fee ~2.9%
    'usd',
    0.1500,
    'succeeded',
    'Payment completed successfully',
    'card',
    'one_time',
    0,
    '{"customerEmail": "john.doe@example.com", "bookingDate": "2026-03-01"}'::jsonb,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '60 days'
  ),
  (
    'mkt-pay-ever-002',
    'mkt-acct-everpoint-001',
    'team-everpoint-001',
    'booking-002',
    'booking',
    'pi_ever_mkt_002',
    'ch_ever_mkt_002',
    'tr_ever_mkt_002',
    15000,    -- $150.00
    2250,     -- $22.50 (15%)
    12750,    -- $127.50
    435,
    'usd',
    0.1500,
    'succeeded',
    'Payment completed successfully',
    'card',
    'one_time',
    0,
    '{"customerEmail": "jane.smith@example.com", "bookingDate": "2026-03-05"}'::jsonb,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days'
  ),
  (
    'mkt-pay-ever-003',
    'mkt-acct-everpoint-001',
    'team-everpoint-001',
    'booking-003',
    'booking',
    'pi_ever_mkt_003',
    'ch_ever_mkt_003',
    'tr_ever_mkt_003',
    50000,    -- $500.00
    7500,     -- $75.00 (15%)
    42500,    -- $425.00
    1450,
    'usd',
    0.1500,
    'succeeded',
    'Payment completed successfully',
    'card',
    'one_time',
    0,
    '{"customerEmail": "bob.williams@example.com", "bookingDate": "2026-03-10"}'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
  ),

  -- Refunded payment
  (
    'mkt-pay-ever-004',
    'mkt-acct-everpoint-001',
    'team-everpoint-001',
    'booking-004',
    'booking',
    'pi_ever_mkt_004',
    'ch_ever_mkt_004',
    'tr_ever_mkt_004',
    35000,    -- $350.00
    5250,     -- $52.50 (15%)
    29750,    -- $297.50
    1015,
    'usd',
    0.1500,
    'refunded',
    'Customer requested full refund - event canceled',
    'card',
    'one_time',
    35000,    -- Full refund
    '{"customerEmail": "carol.taylor@example.com", "bookingDate": "2026-03-08", "refundReason": "event_canceled"}'::jsonb,
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '35 days'
  ),

  -- Partially refunded
  (
    'mkt-pay-ever-005',
    'mkt-acct-everpoint-001',
    'team-everpoint-001',
    'booking-005',
    'booking',
    'pi_ever_mkt_005',
    'ch_ever_mkt_005',
    'tr_ever_mkt_005',
    18000,    -- $180.00
    2700,     -- $27.00 (15%)
    15300,    -- $153.00
    522,
    'usd',
    0.1500,
    'partially_refunded',
    'Partial refund for late check-in',
    'card',
    'one_time',
    5000,     -- $50 partial refund
    '{"customerEmail": "dave.johnson@example.com", "bookingDate": "2026-03-12", "refundReason": "late_checkin"}'::jsonb,
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '20 days'
  ),

  -- Pending payment
  (
    'mkt-pay-ever-006',
    'mkt-acct-everpoint-001',
    'team-everpoint-001',
    'booking-006',
    'booking',
    'pi_ever_mkt_006',
    NULL,
    NULL,
    22000,    -- $220.00
    3300,     -- $33.00 (15%)
    18700,    -- $187.00
    NULL,
    'usd',
    0.1500,
    'pending',
    'Awaiting payment confirmation',
    'card',
    'one_time',
    0,
    '{"customerEmail": "emma.white@example.com", "bookingDate": "2026-03-25"}'::jsonb,
    NULL,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),

  -- ========================================
  -- ALPHA TECH (Stripe Connect, USD, 10%)
  -- ========================================

  (
    'mkt-pay-alpha-001',
    'mkt-acct-alpha-001',
    'team-alpha-001',
    'order-001',
    'order',
    'pi_alpha_mkt_001',
    'ch_alpha_mkt_001',
    'tr_alpha_mkt_001',
    9900,     -- $99.00
    990,      -- $9.90 (10%)
    8910,     -- $89.10
    287,
    'usd',
    0.1000,
    'succeeded',
    'Payment completed successfully',
    'card',
    'one_time',
    0,
    '{"customerEmail": "alice.brown@example.com", "productId": "prod-saas-001"}'::jsonb,
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '50 days'
  ),
  (
    'mkt-pay-alpha-002',
    'mkt-acct-alpha-001',
    'team-alpha-001',
    'order-002',
    'order',
    'pi_alpha_mkt_002',
    'ch_alpha_mkt_002',
    'tr_alpha_mkt_002',
    29900,    -- $299.00
    2990,     -- $29.90 (10%)
    26910,    -- $269.10
    867,
    'usd',
    0.1000,
    'succeeded',
    'Payment completed successfully',
    'card',
    'one_time',
    0,
    '{"customerEmail": "frank.miller@example.com", "productId": "prod-saas-002"}'::jsonb,
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '35 days'
  ),
  (
    'mkt-pay-alpha-003',
    'mkt-acct-alpha-001',
    'team-alpha-001',
    'order-003',
    'order',
    'pi_alpha_mkt_003',
    'ch_alpha_mkt_003',
    'tr_alpha_mkt_003',
    4900,     -- $49.00
    490,      -- $4.90 (10%)
    4410,     -- $44.10
    142,
    'usd',
    0.1000,
    'succeeded',
    'Payment completed successfully',
    'card',
    'one_time',
    0,
    '{"customerEmail": "grace.lee@example.com", "productId": "prod-saas-003"}'::jsonb,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days'
  ),

  -- Failed payment
  (
    'mkt-pay-alpha-004',
    'mkt-acct-alpha-001',
    'team-alpha-001',
    'order-004',
    'order',
    'pi_alpha_mkt_004',
    NULL,
    NULL,
    19900,    -- $199.00
    1990,     -- $19.90 (10%)
    17910,    -- $179.10
    NULL,
    'usd',
    0.1000,
    'failed',
    'Card declined: insufficient funds',
    'card',
    'one_time',
    0,
    '{"customerEmail": "henry.clark@example.com", "productId": "prod-saas-004", "failureCode": "card_declined"}'::jsonb,
    NULL,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  ),

  -- Disputed payment
  (
    'mkt-pay-alpha-005',
    'mkt-acct-alpha-001',
    'team-alpha-001',
    'order-005',
    'order',
    'pi_alpha_mkt_005',
    'ch_alpha_mkt_005',
    'tr_alpha_mkt_005',
    14900,    -- $149.00
    1490,     -- $14.90 (10%)
    13410,    -- $134.10
    432,
    'usd',
    0.1000,
    'disputed',
    'Customer dispute: product not as described',
    'card',
    'one_time',
    0,
    '{"customerEmail": "iris.wang@example.com", "productId": "prod-saas-005", "disputeId": "dp_alpha_001", "disputeReason": "product_not_received"}'::jsonb,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '8 days'
  ),

  -- ========================================
  -- IRONVALE GLOBAL (MercadoPago AR, ARS, 15%)
  -- ========================================

  (
    'mkt-pay-iron-001',
    'mkt-acct-ironvale-001',
    'team-ironvale-002',
    'booking-101',
    'booking',
    'mp_pay_iron_001',
    NULL,
    NULL,
    150000,   -- ARS 150,000
    22500,    -- ARS 22,500 (15%)
    127500,   -- ARS 127,500
    7500,
    'ars',
    0.1500,
    'succeeded',
    'Pago aprobado',
    'credit_card',
    'one_time',
    0,
    '{"customerEmail": "martin.perez@gmail.com", "mpPaymentId": "67890123", "installments": 1}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days'
  ),
  (
    'mkt-pay-iron-002',
    'mkt-acct-ironvale-001',
    'team-ironvale-002',
    'booking-102',
    'booking',
    'mp_pay_iron_002',
    NULL,
    NULL,
    250000,   -- ARS 250,000
    37500,    -- ARS 37,500 (15%)
    212500,   -- ARS 212,500
    12500,
    'ars',
    0.1500,
    'succeeded',
    'Pago aprobado',
    'debit_card',
    'one_time',
    0,
    '{"customerEmail": "lucia.gomez@yahoo.com.ar", "mpPaymentId": "67890124", "installments": 1}'::jsonb,
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '40 days'
  ),
  (
    'mkt-pay-iron-003',
    'mkt-acct-ironvale-001',
    'team-ironvale-002',
    'booking-103',
    'booking',
    'mp_pay_iron_003',
    NULL,
    NULL,
    480000,   -- ARS 480,000
    72000,    -- ARS 72,000 (15%)
    408000,   -- ARS 408,000
    24000,
    'ars',
    0.1500,
    'succeeded',
    'Pago aprobado - 6 cuotas',
    'credit_card',
    'one_time',
    0,
    '{"customerEmail": "nicolas.silva@hotmail.com", "mpPaymentId": "67890125", "installments": 6}'::jsonb,
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '22 days'
  ),

  -- Pending in MercadoPago (waiting for payment)
  (
    'mkt-pay-iron-004',
    'mkt-acct-ironvale-001',
    'team-ironvale-002',
    'booking-104',
    'booking',
    'mp_pay_iron_004',
    NULL,
    NULL,
    95000,    -- ARS 95,000
    14250,    -- ARS 14,250 (15%)
    80750,    -- ARS 80,750
    NULL,
    'ars',
    0.1500,
    'pending',
    'Esperando pago en efectivo (Rapipago)',
    'ticket',
    'one_time',
    0,
    '{"customerEmail": "ana.martinez@gmail.com", "mpPaymentId": "67890126", "paymentPointName": "Rapipago"}'::jsonb,
    NULL,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),

  -- ========================================
  -- RIVERSTONE VENTURES (MercadoPago BR, BRL, 10%)
  -- ========================================

  (
    'mkt-pay-river-001',
    'mkt-acct-riverstone-001',
    'team-riverstone-003',
    'booking-201',
    'booking',
    'mp_pay_river_001',
    NULL,
    NULL,
    35000,    -- BRL 350.00
    3500,     -- BRL 35.00 (10%)
    31500,    -- BRL 315.00
    1750,
    'brl',
    0.1000,
    'succeeded',
    'Pagamento aprovado',
    'credit_card',
    'one_time',
    0,
    '{"customerEmail": "pedro.santos@gmail.com.br", "mpPaymentId": "11223344", "installments": 1}'::jsonb,
    NOW() - INTERVAL '38 days',
    NOW() - INTERVAL '38 days',
    NOW() - INTERVAL '38 days'
  ),
  (
    'mkt-pay-river-002',
    'mkt-acct-riverstone-001',
    'team-riverstone-003',
    'booking-202',
    'booking',
    'mp_pay_river_002',
    NULL,
    NULL,
    89000,    -- BRL 890.00
    8900,     -- BRL 89.00 (10%)
    80100,    -- BRL 801.00
    4450,
    'brl',
    0.1000,
    'succeeded',
    'Pagamento aprovado via Pix',
    'pix',
    'one_time',
    0,
    '{"customerEmail": "maria.oliveira@outlook.com.br", "mpPaymentId": "11223345", "pixKey": "email"}'::jsonb,
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '18 days'
  ),
  (
    'mkt-pay-river-003',
    'mkt-acct-riverstone-001',
    'team-riverstone-003',
    'booking-203',
    'booking',
    'mp_pay_river_003',
    NULL,
    NULL,
    125000,   -- BRL 1,250.00
    12500,    -- BRL 125.00 (10%)
    112500,   -- BRL 1,125.00
    6250,
    'brl',
    0.1000,
    'succeeded',
    'Pagamento aprovado - 3 parcelas',
    'credit_card',
    'one_time',
    0,
    '{"customerEmail": "joao.costa@gmail.com.br", "mpPaymentId": "11223346", "installments": 3}'::jsonb,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),

  -- Refunded BRL payment
  (
    'mkt-pay-river-004',
    'mkt-acct-riverstone-001',
    'team-riverstone-003',
    'booking-204',
    'booking',
    'mp_pay_river_004',
    NULL,
    NULL,
    45000,    -- BRL 450.00
    4500,     -- BRL 45.00 (10%)
    40500,    -- BRL 405.00
    2250,
    'brl',
    0.1000,
    'refunded',
    'Reembolso total - servico nao prestado',
    'credit_card',
    'one_time',
    45000,    -- Full refund
    '{"customerEmail": "rafael.lima@yahoo.com.br", "mpPaymentId": "11223347", "refundReason": "service_not_provided"}'::jsonb,
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '24 days'
  ),

  -- ========================================
  -- DELTA DYNAMICS (MercadoPago MX, MXN, 20%)
  -- ========================================

  (
    'mkt-pay-delta-001',
    'mkt-acct-delta-001',
    'team-delta-004',
    'booking-301',
    'booking',
    'mp_pay_delta_001',
    NULL,
    NULL,
    350000,   -- MXN 3,500.00
    70000,    -- MXN 700.00 (20%)
    280000,   -- MXN 2,800.00
    17500,
    'mxn',
    0.2000,
    'succeeded',
    'Pago aprobado',
    'credit_card',
    'one_time',
    0,
    '{"customerEmail": "carlos.hernandez@gmail.com.mx", "mpPaymentId": "55667788", "installments": 1}'::jsonb,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days'
  ),
  (
    'mkt-pay-delta-002',
    'mkt-acct-delta-001',
    'team-delta-004',
    'booking-302',
    'booking',
    'mp_pay_delta_002',
    NULL,
    NULL,
    180000,   -- MXN 1,800.00
    36000,    -- MXN 360.00 (20%)
    144000,   -- MXN 1,440.00
    9000,
    'mxn',
    0.2000,
    'succeeded',
    'Pago aprobado',
    'debit_card',
    'one_time',
    0,
    '{"customerEmail": "rosa.morales@outlook.com.mx", "mpPaymentId": "55667789", "installments": 1}'::jsonb,
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '12 days'
  ),

  -- Failed MXN payment
  (
    'mkt-pay-delta-003',
    'mkt-acct-delta-001',
    'team-delta-004',
    'booking-303',
    'booking',
    'mp_pay_delta_003',
    NULL,
    NULL,
    520000,   -- MXN 5,200.00
    104000,   -- MXN 1,040.00 (20%)
    416000,   -- MXN 4,160.00
    NULL,
    'mxn',
    0.2000,
    'failed',
    'Tarjeta rechazada: fondos insuficientes',
    'credit_card',
    'one_time',
    0,
    '{"customerEmail": "jorge.lopez@gmail.com.mx", "mpPaymentId": "55667790", "failureCode": "cc_rejected_insufficient_amount"}'::jsonb,
    NULL,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days'
  ),

  -- ========================================
  -- GAMMA INDUSTRIES (Stripe Connect, GBP, 20% - restricted account)
  -- ========================================

  (
    'mkt-pay-gamma-001',
    'mkt-acct-gamma-001',
    'team-gamma-003',
    'booking-401',
    'booking',
    'pi_gamma_mkt_001',
    'ch_gamma_mkt_001',
    'tr_gamma_mkt_001',
    12000,    -- GBP 120.00
    2400,     -- GBP 24.00 (20%)
    9600,     -- GBP 96.00
    348,
    'gbp',
    0.2000,
    'succeeded',
    'Payment completed successfully',
    'card',
    'one_time',
    0,
    '{"customerEmail": "oliver.jones@example.co.uk", "bookingDate": "2026-02-20"}'::jsonb,
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '42 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MARKETPLACE WEBHOOK EVENTS (12 events)
-- ============================================

INSERT INTO public."marketplaceWebhookEvents" (
  id,
  provider,
  "externalEventId",
  "eventType",
  action,
  "resourceId",
  processed,
  "processedAt",
  error,
  "rawPayload",
  "createdAt"
) VALUES
  -- ========================================
  -- STRIPE CONNECT WEBHOOK EVENTS
  -- ========================================

  -- Account onboarding completed
  (
    'mkt-wh-001',
    'stripe_connect',
    'evt_stripe_acct_updated_001',
    'account.updated',
    'onboarding_complete',
    'acct_everpoint_stripe_001',
    TRUE,
    NOW() - INTERVAL '89 days',
    NULL,
    '{"id": "evt_stripe_acct_updated_001", "type": "account.updated", "data": {"object": {"id": "acct_everpoint_stripe_001", "charges_enabled": true, "payouts_enabled": true}}}'::jsonb,
    NOW() - INTERVAL '89 days'
  ),

  -- Payment intent succeeded
  (
    'mkt-wh-002',
    'stripe_connect',
    'evt_stripe_pi_succeeded_001',
    'payment_intent.succeeded',
    'payment_captured',
    'pi_ever_mkt_001',
    TRUE,
    NOW() - INTERVAL '60 days',
    NULL,
    '{"id": "evt_stripe_pi_succeeded_001", "type": "payment_intent.succeeded", "data": {"object": {"id": "pi_ever_mkt_001", "amount": 25000, "currency": "usd"}}}'::jsonb,
    NOW() - INTERVAL '60 days'
  ),

  -- Charge refunded
  (
    'mkt-wh-003',
    'stripe_connect',
    'evt_stripe_charge_refund_001',
    'charge.refunded',
    'refund_processed',
    'ch_ever_mkt_004',
    TRUE,
    NOW() - INTERVAL '35 days',
    NULL,
    '{"id": "evt_stripe_charge_refund_001", "type": "charge.refunded", "data": {"object": {"id": "ch_ever_mkt_004", "amount_refunded": 35000}}}'::jsonb,
    NOW() - INTERVAL '35 days'
  ),

  -- Charge disputed
  (
    'mkt-wh-004',
    'stripe_connect',
    'evt_stripe_dispute_001',
    'charge.dispute.created',
    'dispute_opened',
    'ch_alpha_mkt_005',
    TRUE,
    NOW() - INTERVAL '8 days',
    NULL,
    '{"id": "evt_stripe_dispute_001", "type": "charge.dispute.created", "data": {"object": {"id": "dp_alpha_001", "charge": "ch_alpha_mkt_005", "amount": 14900, "reason": "product_not_received"}}}'::jsonb,
    NOW() - INTERVAL '8 days'
  ),

  -- Account restricted notification
  (
    'mkt-wh-005',
    'stripe_connect',
    'evt_stripe_acct_restricted_001',
    'account.updated',
    'requirements_past_due',
    'acct_gamma_stripe_001',
    TRUE,
    NOW() - INTERVAL '3 days',
    NULL,
    '{"id": "evt_stripe_acct_restricted_001", "type": "account.updated", "data": {"object": {"id": "acct_gamma_stripe_001", "requirements": {"past_due": ["individual.verification.document"]}}}}'::jsonb,
    NOW() - INTERVAL '3 days'
  ),

  -- Payment failed (unprocessed - simulates retry scenario)
  (
    'mkt-wh-006',
    'stripe_connect',
    'evt_stripe_pi_failed_001',
    'payment_intent.payment_failed',
    'payment_failed',
    'pi_alpha_mkt_004',
    FALSE,
    NULL,
    'Retry scheduled: webhook handler timeout',
    '{"id": "evt_stripe_pi_failed_001", "type": "payment_intent.payment_failed", "data": {"object": {"id": "pi_alpha_mkt_004", "last_payment_error": {"code": "card_declined"}}}}'::jsonb,
    NOW() - INTERVAL '10 days'
  ),

  -- ========================================
  -- MERCADOPAGO WEBHOOK EVENTS
  -- ========================================

  -- Payment approved (AR)
  (
    'mkt-wh-007',
    'mercadopago_split',
    'mp_evt_payment_001',
    'payment',
    'payment.created',
    'mp_pay_iron_001',
    TRUE,
    NOW() - INTERVAL '55 days',
    NULL,
    '{"id": "mp_evt_payment_001", "type": "payment", "action": "payment.created", "data": {"id": "67890123"}}'::jsonb,
    NOW() - INTERVAL '55 days'
  ),

  -- Payment approved (BR - Pix)
  (
    'mkt-wh-008',
    'mercadopago_split',
    'mp_evt_payment_002',
    'payment',
    'payment.created',
    'mp_pay_river_002',
    TRUE,
    NOW() - INTERVAL '18 days',
    NULL,
    '{"id": "mp_evt_payment_002", "type": "payment", "action": "payment.created", "data": {"id": "11223345"}}'::jsonb,
    NOW() - INTERVAL '18 days'
  ),

  -- Payment refunded (BR)
  (
    'mkt-wh-009',
    'mercadopago_split',
    'mp_evt_refund_001',
    'payment',
    'payment.updated',
    'mp_pay_river_004',
    TRUE,
    NOW() - INTERVAL '24 days',
    NULL,
    '{"id": "mp_evt_refund_001", "type": "payment", "action": "payment.updated", "data": {"id": "11223347", "status": "refunded"}}'::jsonb,
    NOW() - INTERVAL '24 days'
  ),

  -- Payment approved (MX)
  (
    'mkt-wh-010',
    'mercadopago_split',
    'mp_evt_payment_003',
    'payment',
    'payment.created',
    'mp_pay_delta_001',
    TRUE,
    NOW() - INTERVAL '20 days',
    NULL,
    '{"id": "mp_evt_payment_003", "type": "payment", "action": "payment.created", "data": {"id": "55667788"}}'::jsonb,
    NOW() - INTERVAL '20 days'
  ),

  -- Payment failed (MX - unprocessed)
  (
    'mkt-wh-011',
    'mercadopago_split',
    'mp_evt_payment_fail_001',
    'payment',
    'payment.updated',
    'mp_pay_delta_003',
    FALSE,
    NULL,
    NULL,
    '{"id": "mp_evt_payment_fail_001", "type": "payment", "action": "payment.updated", "data": {"id": "55667790", "status": "rejected"}}'::jsonb,
    NOW() - INTERVAL '6 days'
  ),

  -- Pending ticket payment (AR - not yet processed)
  (
    'mkt-wh-012',
    'mercadopago_split',
    'mp_evt_payment_pending_001',
    'payment',
    'payment.created',
    'mp_pay_iron_004',
    TRUE,
    NOW() - INTERVAL '2 days',
    NULL,
    '{"id": "mp_evt_payment_pending_001", "type": "payment", "action": "payment.created", "data": {"id": "67890126", "status": "pending", "status_detail": "pending_waiting_payment"}}'::jsonb,
    NOW() - INTERVAL '2 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SUCCESS SUMMARY
-- ============================================

DO $$
DECLARE
  account_count INTEGER;
  payment_count INTEGER;
  webhook_count INTEGER;
  total_usd NUMERIC;
  total_ars NUMERIC;
  total_brl NUMERIC;
  total_mxn NUMERIC;
BEGIN
  SELECT COUNT(*) INTO account_count FROM "connectedAccounts" WHERE id LIKE 'mkt-acct-%';
  SELECT COUNT(*) INTO payment_count FROM "marketplacePayments" WHERE id LIKE 'mkt-pay-%';
  SELECT COUNT(*) INTO webhook_count FROM "marketplaceWebhookEvents" WHERE id LIKE 'mkt-wh-%';

  SELECT COALESCE(SUM("totalAmount"), 0) INTO total_usd FROM "marketplacePayments" WHERE id LIKE 'mkt-pay-%' AND currency = 'usd';
  SELECT COALESCE(SUM("totalAmount"), 0) INTO total_ars FROM "marketplacePayments" WHERE id LIKE 'mkt-pay-%' AND currency = 'ars';
  SELECT COALESCE(SUM("totalAmount"), 0) INTO total_brl FROM "marketplacePayments" WHERE id LIKE 'mkt-pay-%' AND currency = 'brl';
  SELECT COALESCE(SUM("totalAmount"), 0) INTO total_mxn FROM "marketplacePayments" WHERE id LIKE 'mkt-pay-%' AND currency = 'mxn';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Theme Migration 093_marketplace_sample_data.sql completed!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  MARKETPLACE DATA STATISTICS:';
  RAISE NOTICE '     Connected Accounts:  %', account_count;
  RAISE NOTICE '     Marketplace Payments: %', payment_count;
  RAISE NOTICE '     Webhook Events:       %', webhook_count;
  RAISE NOTICE '';
  RAISE NOTICE '  CONNECTED ACCOUNTS:';
  RAISE NOTICE '     Everpoint Labs    - Stripe Connect (active, 15%%, USD)';
  RAISE NOTICE '     Alpha Tech        - Stripe Connect (active, 10%%, USD)';
  RAISE NOTICE '     Beta Solutions    - Stripe Connect (in_progress, 15%%)';
  RAISE NOTICE '     Gamma Industries  - Stripe Connect (restricted, 20%%, GBP)';
  RAISE NOTICE '     Ironvale Global   - MercadoPago AR (active, 15%%, ARS)';
  RAISE NOTICE '     Riverstone Ventures - MercadoPago BR (active, 10%%, BRL)';
  RAISE NOTICE '     Delta Dynamics    - MercadoPago MX (active, 20%%, MXN)';
  RAISE NOTICE '';
  RAISE NOTICE '  PAYMENT VOLUME:';
  RAISE NOTICE '     USD: $% (% cents)', (total_usd / 100.0), total_usd;
  RAISE NOTICE '     ARS: $%', total_ars;
  RAISE NOTICE '     BRL: R$% (% centavos)', (total_brl / 100.0), total_brl;
  RAISE NOTICE '     MXN: $%', total_mxn;
  RAISE NOTICE '';
  RAISE NOTICE '  PAYMENT STATUSES:';
  RAISE NOTICE '     succeeded, pending, failed, refunded,';
  RAISE NOTICE '     partially_refunded, disputed';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
