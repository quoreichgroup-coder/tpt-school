import { expect, test } from '@playwright/test'

test('mobile API requires bearer authentication and validates login input', async ({ request }) => {
  const unauthenticatedPortal = await request.get('/api/v1/portal')
  expect(unauthenticatedPortal.status()).toBe(401)
  expect(await unauthenticatedPortal.json()).toEqual({ error: 'Authentication required.' })

  const malformedToken = await request.get('/api/v1/portal', { headers: { Authorization: 'Bearer invalid.token.value' } })
  expect(malformedToken.status()).toBe(401)

  const unauthenticatedTeacherRoster = await request.get('/api/v1/teacher/classes')
  expect(unauthenticatedTeacherRoster.status()).toBe(401)

  const attendancePath = '/api/v1/teacher/classes/untrusted-class/attendance'
  expect((await request.get(attendancePath)).status()).toBe(401)
  expect((await request.post(attendancePath, { data: { date: '2026-11-05', records: [] } })).status()).toBe(401)

  const invalidLogin = await request.post('/api/v1/auth/login', { data: { email: 'not-an-email', password: 'x' } })
  expect(invalidLogin.status()).toBe(400)
})
