/**
 * Admin credentials for tests.
 *
 * Read from the environment if set, otherwise parsed out of backend/.env, so
 * the admin password is never committed to the repo. Loaded here (rather than
 * in playwright.config.js) because each Playwright worker is its own process
 * and only sees env vars it inherited at spawn time.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

function readBackendEnv() {
  const here = dirname(fileURLToPath(import.meta.url))
  try {
    const raw = readFileSync(resolve(here, '../../../backend/.env'), 'utf8')
    const out = {}
    // Split on \r?\n — a stray \r would break the $-anchored match below.
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
    return out
  } catch {
    return {}
  }
}

const fileEnv = readBackendEnv()

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || fileEnv.ADMIN_EMAIL
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || fileEnv.ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'Admin credentials not found. Set ADMIN_EMAIL and ADMIN_PASSWORD, or make ' +
    'sure backend/.env defines them. They must match the running backend.'
  )
}
