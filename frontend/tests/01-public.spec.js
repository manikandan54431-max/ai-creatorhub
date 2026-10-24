import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('homepage loads with key content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/AI CreatorHub/i)
    // Badge/tagline
    await expect(page.getByText(/AI Creator Marketplace/i).first()).toBeVisible()
    // Nav link to creators
    await expect(page.getByRole('link', { name: /creators/i }).first()).toBeVisible()
  })

  test('/creators page renders without crashing', async ({ page }) => {
    await page.goto('/creators', { waitUntil: 'domcontentloaded' })
    // Should not show a JS error page
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
    // Heading or empty state must be visible
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('/login page has email + password form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('/register page has registration form', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('backend health check passes', async ({ request }) => {
    const res = await request.get('http://localhost:8000/api/health')
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.status).toBe('ok')
  })

  test('public stats API returns correct shape', async ({ request }) => {
    const res = await request.get('http://localhost:8000/api/public/stats')
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty('approved_creators')
    expect(data).toHaveProperty('total_clients')
    expect(data).toHaveProperty('completed_orders')
    expect(data).toHaveProperty('avg_rating')
  })
})
