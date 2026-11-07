import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Students module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('navigates to students list', async ({ page }) => {
    await page.goto('/students')
    await expect(page.getByRole('heading', { name: /élèves|students/i })).toBeVisible()
  })

  test('creates a new student', async ({ page }) => {
    await page.goto('/students/new')
    await expect(page.getByRole('heading', { name: /inscrire un nouvel élève|new student|add student/i })).toBeVisible()

    // Fill required fields
    await page.getByLabel(/Prénom|First Name/i).fill('E2E')
    await page.getByLabel(/^Nom \*$/).fill('Student Test')
    await page.getByLabel(/Adresse e-mail|Email Address/i).fill(`e2e-student-${Date.now()}@test.school`)

    await page.getByRole('button', { name: /inscrire l’élève|enrol student|create|save/i }).click()

    // Should redirect to student list or detail
    await expect(page).toHaveURL(/\/students(\/|$)/, { timeout: 10_000 })
  })

  test('student profile page loads', async ({ page }) => {
    await page.goto('/students')
    const firstLink = page.getByRole('link').filter({ hasText: /E2E Student Test/ }).first()
    if (await firstLink.isVisible()) {
      await firstLink.click()
      await expect(page.getByRole('tab', { name: /profile/i })).toBeVisible()
    }
  })
})
