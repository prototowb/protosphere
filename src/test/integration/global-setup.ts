/**
 * Global setup for Supabase integration tests.
 * Resets the local Supabase DB to a clean migration state before the suite runs.
 * Runs once per `vitest run --config vitest.integration.config.ts` invocation.
 */
import { execSync } from 'child_process'

const LOCAL_URL = 'http://127.0.0.1:54321'

// Resolve the supabase CLI — check common locations
const SUPABASE_CLI = (() => {
  const candidates = [
    'C:\\Users\\tobia\\scoop\\shims\\supabase.exe',
    '/c/Users/tobia/scoop/shims/supabase',
    'supabase',
  ]
  for (const c of candidates) {
    try {
      execSync(`"${c}" --version`, { stdio: 'pipe' })
      return c
    } catch {
      // try next
    }
  }
  return null
})()

export async function setup() {
  // Verify local Supabase is reachable before attempting reset
  try {
    const res = await fetch(`${LOCAL_URL}/rest/v1/`, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    if (!res.ok && res.status !== 401) throw new Error(`Unexpected status: ${res.status}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`\n✗ Local Supabase not reachable at ${LOCAL_URL}: ${msg}`)
    console.error('  Run `supabase start` first.\n')
    process.exit(1)
  }

  if (!SUPABASE_CLI) {
    console.error('\n✗ supabase CLI not found — cannot reset DB. Install via scoop: `scoop install supabase`\n')
    process.exit(1)
  }

  console.log('\n→ Resetting local Supabase DB (applying all migrations)...')
  execSync(`"${SUPABASE_CLI}" db reset --workdir "G:/Projects/protocode-chat"`, {
    stdio: 'inherit',
    timeout: 120_000,
  })
  console.log('✓ DB reset complete\n')
}
