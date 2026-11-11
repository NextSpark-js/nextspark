import { queryWithRLS, withServiceTransaction } from '../db'

/** What `guardLastSuperadmin` answers instead of running the write. */
export const LAST_SUPERADMIN = 'LAST_SUPERADMIN' as const

/**
 * Runs `write` (a demotion, suspension or deletion of `targetId`) in one service transaction, unless `targetId` is the
 * last account with the `superadmin` role: then nothing is written and LAST_SUPERADMIN comes back.
 *
 * The superadmin rows are locked first (`FOR UPDATE`), so two requests that each remove one of the last two superadmins
 * run one after the other: the second waits for the first to commit, then no longer counts the account the first one
 * removed, and is refused. The caller authorizes; every db helper `write` calls on the service connection joins the
 * transaction.
 */
export async function guardLastSuperadmin<T>(
  targetId: string,
  actorId: string,
  write: () => Promise<T>,
): Promise<T | typeof LAST_SUPERADMIN> {
  return withServiceTransaction(async () => {
    const superadmins = await queryWithRLS<{ id: string }>(
      `SELECT id FROM "users" WHERE role = 'superadmin' FOR UPDATE`,
      [],
      actorId,
      { service: true },
    )
    if (superadmins.length <= 1 && superadmins.some((row) => row.id === targetId)) return LAST_SUPERADMIN
    return write()
  })
}
