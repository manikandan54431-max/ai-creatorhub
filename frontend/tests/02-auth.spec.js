import { test, expect } from '@playwright/test'

import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/admin.js'

// Reusable login helper for this file
async function loginAs(page, email, password) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  // Wait for React to mount the form before filling
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

test.describe('Authentication', () => {
  test('admin login redirects to admin dashboard', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    // Admin route is /admin — use toHaveURL (not waitForURL which waits for 'load')
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })
  })

  test('wrong password keeps user on login page', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, 'definitely-wrong-password')
    // Wrong password must NOT navigate away from /login
    // Give time for the API response and any redirect to happen
    await page.waitForTimeout(3_000)
    await expect(page).toHaveURL(/\/login/)
  })

  test('unknown email keeps user on login page', async ({ page }) => {
    await loginAs(page, 'nobody@example.com', 'whatever123')
    await page.waitForTimeout(3_000)
    await expect(page).toHaveURL(/\/login/)
  })

  test('admin can log out', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    // Admin lands at /admin — use toHaveURL (not waitForURL which waits for 'load')
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })

    // Admin sidebar has a direct "Logout" button (AdminLayout.jsx)
    await page.getByRole('button', { name: /logout/i }).first().click()

    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('client can register a new account', async ({ page }) => {
    const unique = `smoke.reg.${Date.now()}@playwright.test`
    await page.goto('/register', { waitUntil: 'domcontentloaded' })

    await page.locator('input[type="text"]').first().fill('Smoke Reg Client')
    await page.locator('input[type="email"]').fill(unique)
    await page.locator('input[type="password"]').first().fill('SmokeTest@123')

    // Select "Client" role — button text is "🏢 I'm a Client"
    const clientOption = page.getByRole('button', { name: /client/i }).first()
    if (await clientOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await clientOption.click()
    }

    await page.getByRole('button', { name: /create account/i }).click()
    // After registration, should land on a dashboard (client or creator)
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
  })

  test('creator can register a new account', async ({ page }) => {
    const unique = `smoke.reg.cr.${Date.now()}@playwright.test`
    await page.goto('/register', { waitUntil: 'domcontentloaded' })

    await page.locator('input[type="text"]').first().fill('Smoke Reg Creator')
    await page.locator('input[type="email"]').fill(unique)
    await page.locator('input[type="password"]').first().fill('SmokeTest@123')

    // Select "Creator" role — button text is "🎨 I'm a Creator"
    const creatorOption = page.getByRole('button', { name: /creator/i }).first()
    if (await creatorOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await creatorOption.click()
    }

    await page.getByRole('button', { name: /create account/i }).click()
    // waitForURL defaults to 'load' which can hang on SPA; use URL check with polling instead
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
  })

  test('protected route redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    // AdminRoute redirects unauthenticated users to /admin/login
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('API returns 401/403 for protected endpoint without token', async ({ request }) => {
    const res = await request.get('http://localhost:8000/api/auth/me')
    expect([401, 403]).toContain(res.status())
  })
})
