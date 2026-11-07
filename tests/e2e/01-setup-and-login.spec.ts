import { test, expect } from '@playwright/test'
import { setupIfNeeded, loginAsAdmin, TEST_ADMIN, TEST_SCHOOL } from './helpers'

test.describe('Setup wizard + login', () => {
  test('runs setup wizard on first visit', async ({ page }) => {
    const setupRan = await setupIfNeeded(page)
    if (setupRan) {
      // Redirected to dashboard after setup
      await expect(page).toHaveURL(/\/dashboard/)
      await page.goto('/settings')
      await page.getByRole('tab', { name: /academic years/i }).click()
      await expect(page.getByText(TEST_SCHOOL.currentYear, { exact: true })).toBeVisible()
      await expect(page.getByText(/· 4 terms/i)).toBeVisible()
      await expect(page.getByText('Active', { exact: true })).toBeVisible()
    } else {
      // Already set up — just verify login still works
      await loginAsAdmin(page)
      await expect(page).toHaveURL(/\/dashboard/)
    }
  })

  test('login page rejects wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/adresse e-mail|email address/i).fill(TEST_ADMIN.email)
    await page.getByLabel(/mot de passe|password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /se connecter|sign in/i }).click()
    await expect(page.locator('text=/invalide|incorrect|échec|invalid|failed/i')).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('protected routes redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('logs in as admin and sees dashboard', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page.getByRole('heading', { name: TEST_ADMIN.name, exact: true })).toBeVisible()
  })

  test('signs out', async ({ page }) => {
    await loginAsAdmin(page)
    // Find and click sign-out (button or menu item)
    await page.getByRole('button', { name: /e2e admin/i }).click()
    await page.getByRole('menuitem', { name: /déconnexion|sign out|log out/i }).click()
    await page.waitForURL(/\/login/, { timeout: 5_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
