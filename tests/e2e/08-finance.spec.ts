import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Finance module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('finance dashboard loads', async ({ page }) => {
    await page.goto('/finance')
    await expect(page.getByRole('heading', { name: /finances|finance/i })).toBeVisible()
  })

  test('fee types page loads', async ({ page }) => {
    await page.goto('/finance/fee-types')
    await expect(page.getByRole('heading', { name: /types de frais|fee type/i })).toBeVisible()
  })

  test('new invoice form renders', async ({ page }) => {
    await page.goto('/finance/invoices/new')
    await expect(page.getByRole('heading', { name: /facture|invoice/i })).toBeVisible()
  })
})
