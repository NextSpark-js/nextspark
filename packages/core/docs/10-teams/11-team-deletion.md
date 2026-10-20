# Team Deletion

Deleting a team is a **soft delete**: the row stays, access is revoked, and a scheduled action removes it for good once the retention has passed.

## Lifecycle

| Step | When | What happens |
|------|------|--------------|
| 1. Delete | `DELETE /api/v1/teams/:teamId` or `TeamService.delete(teamId, userId)` (owner only) | `team.before_delete` hooks run and may veto. Then, in one transaction: `teams."deletedAt"` is set, every `team_members` row is removed, pending `team_invitations` are deleted and `isGlobal` is cleared (a replacement global team can be created). Then `team.deleted` hooks run. |
| 2. Retention | `deletedRetentionDays` (30 by default) | The row is kept, hidden from every read. |
| 3. Purge | `teams:purge-deleted` scheduled action | The row is deleted; members, invitations, subscriptions and every table that references `teams` with `ON DELETE CASCADE` go with it. |

After step 1:

- The team is gone from `GET /api/v1/teams` (the `scope=all` listing for admins still shows it), `GET`/`PATCH /api/v1/teams/:teamId`, the active-team resolution (`switchActive`, the dashboard team, the `x-team-id` header, which answers `403 TEAM_NOT_FOUND`) and `TeamService` readers (`getById`, `getBySlug`, `getUserTeams`, `exists`, ...).
- Former members have no membership: every permission and membership check fails, and the team cannot be reached with an API key.
- Its invitations are gone: accepting or declining by token answers not found, and nobody can invite to it.
- Its slug stays reserved until the purge (the unique index still covers the row).
- Data your project keeps outside the cascade (tables with a plain `teamId` column and no foreign key) is not touched. Clean it in a `team.deleted` hook, or purge it yourself.

- Nothing can join it: adding a member, creating an invitation, accepting one and `signup-with-invite` all refuse a deleted team (`signup-with-invite` answers `404 TEAM_NOT_FOUND`; if the team was deleted while the sign-up ran, the account stays created, without a team).
- Superadmin and developer requests bypass the membership checks, so the generic entity handler still operates on the entities of a deleted team until the purge.

There is no restore: step 1 revokes the memberships.

## Retention

```typescript
// app.config.ts
export const themeAppConfig: DeepPartial<AppConfig> = {
  teams: {
    options: {
      deletedRetentionDays: 14, // default: 30; 0 purges on the next run
    },
  },
}
```

A value that is not a number >= 0 falls back to 30.

`TeamService.delete` schedules the first `teams:purge-deleted` run for the end of the retention. Each run purges what has expired and, while deleted teams are still waiting, schedules the next run for the earliest expiry, so a changed retention never strands a team. The action is registered by core and runs wherever `GET /api/v1/cron/process` runs (see [Scheduled Actions](../20-scheduled-actions/01-overview.md)). To purge on your own schedule, call `TeamService.purgeDeleted()` (returns the number of teams removed).

## Hooks

Both hooks live on the global hook system (see [Hooks and lifecycle](../04-entities/08-hooks-and-lifecycle.md#global-hooks-plugin-system)). The payload is `{ teamId, team, userId }` (`team` is the row before the deletion, `userId` the owner who deleted).

### `team.before_delete` (filter)

Runs before anything changes. **Throw to veto**: the team stays intact and the route answers `409` with code `TEAM_DELETE_VETOED` and the error message. A hook that returns normally allows the deletion. A hook that fails for any other reason vetoes too.

```typescript
import { getGlobalHooks } from '@nextsparkjs/core/lib/plugins/hook-system'
import { TEAM_BEFORE_DELETE_HOOK } from '@nextsparkjs/core/lib/services'

getGlobalHooks().addFilter(TEAM_BEFORE_DELETE_HOOK, async ({ teamId }) => {
  if (await hasActiveContract(teamId)) {
    throw new Error('Cancel the active contract before deleting the team')
  }
})
```

Hook names are `TEAM_BEFORE_DELETE_HOOK` (`team.before_delete`) and `TEAM_DELETED_HOOK` (`team.deleted`), exported from `@nextsparkjs/core/lib/services`.

### `team.deleted` (action)

Runs after the transaction committed. Use it to clean your own data tied to the team. A failure is logged and does not undo the deletion or fail the request.

```typescript
getGlobalHooks().addAction(TEAM_DELETED_HOOK, async ({ teamId }) => {
  await removeProjectDataOf(teamId)
})
```

Register hooks once at server start (for example in a plugin's `onLoad`).

## API

`DELETE /api/v1/teams/:teamId` answers `200 { deleted: true, id }`; `403 INSUFFICIENT_PERMISSIONS` (not the owner), `403 GLOBAL_TEAM_DELETE_FORBIDDEN` / `403 SYSTEM_TEAM_DELETE_FORBIDDEN` (the single-tenant global team and the system admin team, which would reopen the first-user bootstrap or drop the platform admin team, cannot be deleted), `404 TEAM_NOT_FOUND` (unknown or already deleted) and `409 TEAM_DELETE_VETOED` (a hook refused).
