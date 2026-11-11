-- Migration: 046_rls_auth_helpers_stable.sql
-- Description: get_auth_user_id() and get_auth_user_email() are STABLE, so a comparison with them can use an index (#436).
--
-- get_auth_user_id() was created without a volatility, so it was VOLATILE. A VOLATILE call in a WHERE is evaluated for
-- every row and is never an index condition: a helper function whose body filters with "userId" = get_auth_user_id()
-- (core's get_auth_user_email(), and a project's own helpers) read its whole table on every call, and a policy that
-- calls it bare on a large table did that once per row. STABLE is what the function is: it returns the same value for
-- every row of a statement, since it reads only app.user_id, which lib/db sets before the statement runs. A statement
-- still sees a new value set by an earlier statement of the same transaction: STABLE holds within one statement only.
--
-- The other RLS helpers of core were already STABLE (get_user_team_ids, is_superadmin, can_bypass_rls, the auth_*
-- functions, get_auth_user_email); get_auth_user_email() is restated here so that one file states both.
-- cleanup_expired_invitations() writes and stays VOLATILE. Who can read or write what does not change.
--
-- ALTER FUNCTION only edits the catalog. Idempotent: a second run sets what is already set.

ALTER FUNCTION public.get_auth_user_id() STABLE;
ALTER FUNCTION public.get_auth_user_email() STABLE;
