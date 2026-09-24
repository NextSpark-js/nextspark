-- Migration: 028_api_audit_log_insert_policy.sql
-- Description: Allow authenticated runtime users to write only their own API audit rows.
-- Issue: #206
--
-- 005 assumed audit writes would use an RLS-bypass service connection. The
-- generic-handler, legacy API, and MCP writers instead carry an authenticated
-- userId through mutateWithRLS, which intentionally uses the application pool.
-- Keep that least-privilege path and authorize only rows attributed to the
-- current RLS principal.

DROP POLICY IF EXISTS "API logs insert own" ON public."api_audit_log";

CREATE POLICY "API logs insert own" ON public."api_audit_log"
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = public.get_auth_user_id());

COMMENT ON POLICY "API logs insert own" ON public."api_audit_log" IS
  'Audit writers use the RLS-enforced application connection and may only attribute rows to the current authenticated user.';
