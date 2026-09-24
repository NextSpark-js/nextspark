# Core real-database tests

These tests are explicit opt-ins because they start a real local PostgreSQL
cluster and apply the repository migrations.

## Generic-handler audit RLS

```bash
gtimeout 300 pnpm test:audit-log-rls
```

The test initializes a trust-auth cluster under `<worktree>/.e2e/pg`, uses a
short Unix-socket path under `/tmp`, applies the core migrations, and connects
the runtime pool as the non-owner `nextspark_app` role. It invokes
the generic-handler audit writer and verifies both sides of the policy:

- exactly one row lands for the acting user;
- an insert that claims another user's ID is rejected with PostgreSQL `42501`.

The cluster is stopped and `<worktree>/.e2e` is removed in a `finally` block.
