import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Staff module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('navigates to staff list', async ({ page }) => {
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: /personnel|staff/i })).toBeVisible()
  })

  test('new staff form renders', async ({ page }) => {
    await page.goto('/staff/new')
    await expect(page.getByRole('heading', { name: /ajouter un membre du personnel|add staff member/i })).toBeVisible()
    await expect(page.getByLabel(/Prénom|First Name/i)).toBeVisible()
    await expect(page.getByLabel(/^Nom\b|Last Name/i)).toBeVisible()
    await expect(page.getByLabel(/Adresse e-mail|Email Address/i)).toBeVisible()
  })
})
