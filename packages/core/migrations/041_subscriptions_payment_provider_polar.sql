-- Migration: 041_subscriptions_payment_provider_polar.sql
-- Description: subscriptions."paymentProvider" accepts 'polar' (#282).
--
-- The Polar webhook sets "paymentProvider" = 'polar' on checkout.updated and subscription.created, which
-- subscriptions_paymentProvider_check (013: stripe, paddle, lemonsqueezy) refused, so those webhooks answered 500. This
-- adds 'polar' to the providers the constraint already accepts and keeps every other one, including providers a project
-- added to it. Idempotent: a constraint that already accepts 'polar' is left alone. A constraint that is not a plain
-- list of providers is left alone too, with a notice (add 'polar' to it yourself).

DO $$
DECLARE
  def       TEXT;
  providers TEXT[];
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.subscriptions'::regclass AND c.conname = 'subscriptions_paymentProvider_check';

  IF def IS NULL THEN
    ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_paymentProvider_check"
      CHECK ("paymentProvider" IN ('stripe', 'paddle', 'lemonsqueezy', 'polar')) NOT VALID; -- existing rows are not checked
    RETURN;
  END IF;

  IF def ~ '''polar''' THEN
    RETURN;
  END IF;

  -- "paymentProvider" IN (...) is stored as: CHECK (("paymentProvider" = ANY (ARRAY['stripe'::text, ...])))
  IF def !~ '^CHECK \(\(+"paymentProvider"\)?(::text)? = ANY \(\(?ARRAY\[' THEN
    RAISE NOTICE 'subscriptions_paymentProvider_check is not a plain list of providers (%); add ''polar'' to it to use Polar', def;
    RETURN;
  END IF;

  SELECT array_agg(m[1]) INTO providers FROM regexp_matches(def, '''([^'']+)''', 'g') AS m;

  ALTER TABLE public."subscriptions" DROP CONSTRAINT "subscriptions_paymentProvider_check";
  EXECUTE format(
    'ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_paymentProvider_check" CHECK ("paymentProvider" IN (%s))',
    (SELECT string_agg(quote_literal(p), ', ') FROM unnest(array_append(providers, 'polar')) AS p)
  );
END $$;
