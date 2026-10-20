/**
 * #324: the repair of a user without a team (lib/auth/personal-team-repair) against a real PostgreSQL: one team under
 * concurrent requests, none for a user that is team-less on purpose, with a pending invitation, or that ever had a team.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, runs core's migrations on it, and is
 * skipped when they are not on the PATH.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Client } from 'pg'

// Importing lib/auth builds the Better Auth instance; the repair only needs its invitation helper.
jest.mock('better-auth', () => ({ betterAuth: () => ({ api: {}, $Infer: {} }), APIError: class extends Error {} }))
jest.mock('better-auth/plugins', () => ({ emailOTP: () => ({ id: 'email-otp' }) }))
jest.mock('better-auth/next-js', () => ({ nextCookies: () => ({ id: 'next-cookies' }) }))

const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)
const describeWithPostgres = HAS_POSTGRES ? describe : describe.skip
const MIGRATIONS = path.resolve(__dirname, '../../../migrations')

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

describeWithPostgres('repairMissingPersonalTeam', () => {
  let dir: string
  let owner: Client
  let db: typeof import('@nextsparkjs/core/lib/db')
  let repair: typeof import('@nextsparkjs/core/lib/auth/personal-team-repair').repairMissingPersonalTeam

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-team-pg-'))
    const port = await freePort()
    execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
    const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
    owner = new Client({ connectionString: url })
    // the cluster stops under it at the end
    owner.on('error', () => {})
    await owner.connect()
    for (const file of fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql').sort()) {
      await owner.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
    }

    // lib/db.ts opens its pools on import, from DATABASE_URL
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(40)
    delete process.env.DATABASE_SERVICE_URL
    jest.doMock('@/core/lib/config/config-sync', () => {
      const actual = jest.requireActual<Record<string, any>>('@/core/lib/config/config-sync')
      return { ...actual, TEAMS_CONFIG: { ...actual.TEAMS_CONFIG, mode: 'multi-tenant' } }
    })
    db = require('@nextsparkjs/core/lib/db')
    repair = require('@nextsparkjs/core/lib/auth/personal-team-repair').repairMissingPersonalTeam
    jest.spyOn(console, 'log').mockImplementation(() => {})

    await owner.query(`
      INSERT INTO users (id, email, name, role, "emailVerified") VALUES
        ('orphan', 'orphan@example.test', 'Orphan', 'member', true),
        ('teamless', 'teamless@example.test', 'Teamless', 'member', true),
        ('invited', 'invited@example.test', 'Invited', 'member', true),
        ('former', 'former@example.test', 'Former', 'member', true),
        ('member', 'member@example.test', 'Member', 'member', true);
      INSERT INTO users_metas ("userId", "metaKey", "metaValue", "dataType") VALUES ('teamless', 'signup_intent', to_jsonb('client'::text), 'string');
      INSERT INTO teams (id, name, slug, "ownerId") VALUES ('t-former', 'Gone', 'gone', 'former'), ('t-member', 'Mine', 'mine', 'member');
      UPDATE teams SET "deletedAt" = now() WHERE id = 't-former';
      INSERT INTO team_members ("teamId", "userId", role) VALUES ('t-former', 'former', 'owner'), ('t-member', 'member', 'owner');
      INSERT INTO team_invitations (id, "teamId", email, role, token, "invitedBy") VALUES ('inv-1', 't-member', 'invited@example.test', 'member', 'tok', 'member');
    `)
  }, 120000)

  afterAll(async () => {
    await db?.pool.end()
    await owner?.end()
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const count = async (sql: string, params: unknown[] = []) => (await owner.query(sql, params)).rows[0].n as number

  test('concurrent first requests of one user create exactly one team, and every request answers with it or, while another holds the lock, nothing', async () => {
    const ids = await Promise.all(Array.from({ length: 10 }, () => repair('orphan')))

    const teams = (await owner.query(`SELECT "teamId", role FROM team_members WHERE "userId" = 'orphan'`)).rows
    expect(teams).toHaveLength(1)
    expect(teams[0].role).toBe('owner')
    expect(await count(`SELECT count(*)::int AS n FROM teams WHERE "ownerId" = 'orphan'`)).toBe(1)
    expect(ids).toContain(teams[0].teamId)
    expect(ids.every(id => id === undefined || id === teams[0].teamId)).toBe(true)
  })

  test('a user that has a team is left alone', async () => {
    expect(await repair('orphan')).toBeDefined() // its existing team
    expect(await repair('member')).toBe('t-member')
    expect(await count(`SELECT count(*)::int AS n FROM teams WHERE "ownerId" IN ('orphan', 'member')`)).toBe(2)
  })

  test.each([
    ['a deliberate team-less signup', 'teamless'],
    ['a pending invitation', 'invited'],
    ['an owner whose only team was deleted (the membership row remains)', 'former'],
  ])('not repaired: %s', async (_label, userId) => {
    expect(await repair(userId)).toBeUndefined()
    expect(await count(`SELECT count(*)::int AS n FROM teams WHERE "ownerId" = $1 AND "deletedAt" IS NULL`, [userId])).toBe(0)
    expect(await count(`SELECT count(*)::int AS n FROM team_members WHERE "userId" = $1 AND "teamId" NOT IN ('t-former', 't-member')`, [userId])).toBe(0)
  })

  test('an unknown user is not repaired and nothing throws', async () => {
    expect(await repair('nobody')).toBeUndefined()
  })

  test('a member removed from their only team (membership row deleted, never an owner) gets a personal team', async () => {
    await owner.query(`INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('removed', 'removed@example.test', 'Removed', 'member', true)`)
    const id = await repair('removed')
    expect(id).toBeDefined()
    expect(await count(`SELECT count(*)::int AS n FROM team_members WHERE "userId" = 'removed' AND "teamId" = $1`, [id])).toBe(1)
  })

  test('more concurrent repairs than the pool has connections: no stall, one team per user', async () => {
    const users = Array.from({ length: 30 }, (_, i) => `${i.toString(36).padStart(4, '0')}-bulk`) // TeamService.create's slug takes the first 4 characters of the id
    await owner.query(`INSERT INTO users (id, email, name, role, "emailVerified") SELECT u, u || '@example.test', u, 'member', true FROM unnest($1::text[]) u`, [users])
    const started = Date.now()
    // every user three times at once, and one user thirty times
    const results = await Promise.all([
      ...users.flatMap(u => [repair(u), repair(u), repair(u)]),
      ...Array.from({ length: 30 }, () => repair(users[0])),
    ])
    expect(Date.now() - started).toBeLessThan(8000)
    expect(results.filter(r => r === undefined).length).toBeLessThan(results.length) // some answered before the winner finished
    for (const u of users) {
      expect(await count(`SELECT count(*)::int AS n FROM teams WHERE "ownerId" = $1`, [u])).toBe(1)
      expect(await count(`SELECT count(*)::int AS n FROM team_members WHERE "userId" = $1`, [u])).toBe(1)
    }
  }, 30000)
})
