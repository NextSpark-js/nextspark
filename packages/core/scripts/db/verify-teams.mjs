#!/usr/bin/env node
/**
 * Verify Teams core setup
 * Checks: users, teams, team_members, RLS policies, helper functions
 * Run with: node core/scripts/db/verify-teams.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function verifyTeamsSetup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('🔍 Verifying Teams Core Setup...\n')

    // 1. Check users
    console.log('👤 USERS:')
    const users = await pool.query(`
      SELECT id, email, role, "firstName" FROM users ORDER BY email
    `)
    users.rows.forEach(u => {
      console.log(`   ${u.email} | ${u.role} | ${u.firstName}`)
    })
    console.log(`   Total: ${users.rowCount} users\n`)

    // 2. Check teams
    console.log('🏢 TEAMS:')
    const teams = await pool.query(`
      SELECT id, name, slug, "ownerId" FROM teams ORDER BY name
    `)
    teams.rows.forEach(t => {
      console.log(`   ${t.name} (${t.slug}) - owner: ${t.ownerId.substring(0, 12)}...`)
    })
    console.log(`   Total: ${teams.rowCount} teams\n`)

    // 3. Check team_members
    console.log('👥 TEAM MEMBERS:')
    const members = await pool.query(`
      SELECT tm."teamId", tm."userId", tm.role, t.name as team_name, u.email
      FROM team_members tm
      JOIN teams t ON tm."teamId" = t.id
      JOIN users u ON tm."userId" = u.id
      ORDER BY t.name, tm.role
    `)
    members.rows.forEach(m => {
      console.log(`   ${m.team_name} → ${m.email} (${m.role})`)
    })
    console.log(`   Total: ${members.rowCount} memberships\n`)

    // 4. Verify helper functions exist
    console.log('⚙️  HELPER FUNCTIONS:')
    const functions = await pool.query(`
      SELECT proname FROM pg_proc
      WHERE proname IN ('get_user_team_ids', 'is_superadmin', 'get_auth_user_id')
    `)
    functions.rows.forEach(f => {
      console.log(`   ✅ ${f.proname}()`)
    })
    console.log('')

    // 7. Verify RLS is enabled
    console.log('🔒 RLS ENABLED:')
    const rls = await pool.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('teams', 'team_members', 'team_invitations', 'tasks', 'customers')
      ORDER BY tablename
    `)
    rls.rows.forEach(t => {
      const status = t.rowsecurity ? '✅' : '❌'
      console.log(`   ${status} ${t.tablename}`)
    })

    console.log('\n✅ Verification complete!')

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

verifyTeamsSetup()
