/**
 * Regression tests for the AI-integration removal.
 *
 * Proves two things:
 *   1. The retained creator workflow still works with no AI provider configured
 *      (creator logs in, sees their assigned order, opens the Video Studio).
 *   2. Every removed AI surface is actually gone — no assistant panel in the
 *      order page, no chatbot on public pages, and all AI endpoints 404.
 *
 * Setup (beforeAll):
 *   1. Register a test creator + test client via API
 *   2. Admin approves the creator profile
 *   3. Admin creates an assignment → which creates an order assigned to the creator
 *
 * Teardown (afterAll):
 *   - Admin deletes both test users (cascades to their data)
 */
import { test, expect } from '@playwright/test'
import {
  apiLogin, apiRegister, apiGet, apiPost, apiPut, apiDelete,
} from './helpers/api.js'

import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/admin.js'
const TS = Date.now()
const CREATOR_EMAIL = `pw.creator.${TS}@playwright.test`
const CLIENT_EMAIL = `pw.client.${TS}@playwright.test`
const TEST_PASS = 'SmokeTest@123'

let adminToken = ''
let creatorId = 0
let clientId = 0
let orderId = 0

// Every endpoint that the AI removal deleted.
const REMOVED_AI_ENDPOINTS = [
  '/api/ai/generate-bio',
  '/api/ai/generate-brief',
  '/api/ai/content-ideas',
  '/api/ai/portfolio-caption',
  '/api/ai/chat-assistant',
  '/api/helpbot/status',
  '/api/helpbot/chat',
  '/api/creator/studio/ai/script-assistant',
  '/api/creator/studio/ai/caption-hint',
  '/api/creator/studio/ai/voiceover-hint',
  '/api/creator/studio/ai/generation-config',
  '/api/creator/studio/ai/generate-image',
  '/api/creator/studio/ai/generate-video',
  '/api/admin/settings/test-ai',
]

// ── Setup & teardown ──────────────────────────────────────────────────────────
test.beforeAll(async () => {
  const admin = await apiLogin(ADMIN_EMAIL, ADMIN_PASSWORD)
  adminToken = admin.access_token

  const creator = await apiRegister('PW Creator', CREATOR_EMAIL, TEST_PASS, 'creator')
  creatorId = creator.user.id

  const client = await apiRegister('PW Client', CLIENT_EMAIL, TEST_PASS, 'client')
  clientId = client.user.id

  const profiles = await apiGet('/api/admin/creators?status=pending&limit=50', adminToken)
  const profile = profiles.find(p => p.user_id === creatorId)
  if (!profile) throw new Error('Creator profile not found after registration')

  await apiPut(`/api/admin/creators/${profile.id}/approve`, {}, adminToken)

  const assignment = await apiPost('/api/admin/assignments', {
    client_id: clientId,
    creator_id: creatorId,
    project_title: 'PW Smoke: Smartwatch Ad',
    project_description:
      'Create a 30-second product showcase for a smartwatch. ' +
      'Target audience: tech-savvy 25–35 year olds. Style: modern, minimal, energetic.',
    required_category: 'AI Video',
    budget: 5000,
  }, adminToken)

  orderId = assignment.order_id
  if (!orderId) throw new Error('Assignment did not return an order_id')
})

test.afterAll(async () => {
  if (adminToken && creatorId) {
    await apiDelete(`/api/admin/users/${creatorId}`, adminToken).catch(() => {})
  }
  if (adminToken && clientId) {
    await apiDelete(`/api/admin/users/${clientId}`, adminToken).catch(() => {})
  }
})

// ── Reusable login helper ─────────────────────────────────────────────────────
async function loginViaUI(page, email, password) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

// ── Retained workflows ────────────────────────────────────────────────────────
test.describe('Creator workflow without AI', () => {

  test('creator can login and reach their dashboard', async ({ page }) => {
    await loginViaUI(page, CREATOR_EMAIL, TEST_PASS)
    await expect(page).toHaveURL(/creator\/dashboard/, { timeout: 12_000 })
  })

  test('creator can open their assigned order', async ({ page }) => {
    await loginViaUI(page, CREATOR_EMAIL, TEST_PASS)
    await expect(page).toHaveURL(/creator\/dashboard/, { timeout: 12_000 })

    await page.goto(`/creator/orders/${orderId}`, { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByText('PW Smoke: Smartwatch Ad', { exact: false })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Video Studio opens and is no longer called AI Studio', async ({ page }) => {
    await loginViaUI(page, CREATOR_EMAIL, TEST_PASS)
    await expect(page).toHaveURL(/creator\/dashboard/, { timeout: 12_000 })

    await page.goto('/creator/video-studio', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByText('Video Studio', { exact: false }).first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/AI Studio/i)).toHaveCount(0)
  })

  test('legacy /creator/ai-studio link still redirects', async ({ page }) => {
    await loginViaUI(page, CREATOR_EMAIL, TEST_PASS)
    await expect(page).toHaveURL(/creator\/dashboard/, { timeout: 12_000 })

    await page.goto('/creator/ai-studio', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/creator\/video-studio/, { timeout: 10_000 })
  })
})

// ── Removal verification ──────────────────────────────────────────────────────
test.describe('AI integrations are removed', () => {

  test('order page has no AI assistant panel or AI controls', async ({ page }) => {
    await loginViaUI(page, CREATOR_EMAIL, TEST_PASS)
    await expect(page).toHaveURL(/creator\/dashboard/, { timeout: 12_000 })

    await page.goto(`/creator/orders/${orderId}`, { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByText('PW Smoke: Smartwatch Ad', { exact: false })
    ).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText(/AI Project Assistant/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Analyse Project Brief/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Generate AI Brief/i })).toHaveCount(0)
    await expect(page.getByText(/AI Tools/i)).toHaveCount(0)
  })

  test('public pages have no floating chatbot', async ({ page }) => {
    for (const path of ['/', '/creators', '/how-it-works']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByPlaceholder(/ask|chat|message/i)).toHaveCount(0)
      await expect(page.getByText(/AI assistant|chatbot/i)).toHaveCount(0)
    }
  })

  test('hire page no longer offers AI brief generation', async ({ page }) => {
    await page.goto('/creators', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /AI Generate/i })).toHaveCount(0)
  })

  for (const path of REMOVED_AI_ENDPOINTS) {
    test(`API ${path} returns 404`, async ({ request }) => {
      const { access_token } = await apiLogin(CREATOR_EMAIL, TEST_PASS)
      const headers = { Authorization: `Bearer ${access_token}` }
      const get = await request.get(`http://localhost:8000${path}`, { headers })
      const post = await request.post(`http://localhost:8000${path}`, { headers, data: {} })
      expect(get.status(), `GET ${path}`).toBe(404)
      expect(post.status(), `POST ${path}`).toBe(404)
    })
  }

  test('project assistant endpoint is gone', async ({ request }) => {
    const { access_token } = await apiLogin(CREATOR_EMAIL, TEST_PASS)
    const res = await request.get(
      `http://localhost:8000/api/creator/ai-assistant/${orderId}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    expect(res.status()).toBe(404)
  })

  test('retained studio API still works without AI config', async ({ request }) => {
    const { access_token } = await apiLogin(CREATOR_EMAIL, TEST_PASS)
    const res = await request.get(
      'http://localhost:8000/api/creator/studio/projects',
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    expect(res.ok()).toBeTruthy()
  })

  test('notifications still work', async ({ request }) => {
    const { access_token } = await apiLogin(CREATOR_EMAIL, TEST_PASS)
    const res = await request.get('http://localhost:8000/api/notifications', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    expect(res.ok()).toBeTruthy()
    expect(Array.isArray(await res.json())).toBe(true)
  })
})
