import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyPassword } from '@/lib/auth'
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/rate-limit'
import { createMobileSession } from '@/lib/mobile-auth'
import { db } from '@/lib/db'

const credentialsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) })

export async function POST(request: Request) {
  let credentials: z.infer<typeof credentialsSchema>
  try {
    credentials = credentialsSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Valid email and password are required.' }, { status: 400 })
  }
  const email = credentials.email.trim().toLowerCase()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = await checkLoginRateLimit(email, ip)
  if (!limit.allowed) return NextResponse.json({ error: limit.error }, { status: 429 })

  const user = await db.user.findUnique({ where: { email } })
  const valid = !!user?.active && !!user.passwordHash && await verifyPassword(credentials.password, user.passwordHash)
  await recordLoginAttempt(email, ip, valid)
  if (!valid || !user) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  if (!['admin', 'teacher', 'parent', 'student'].includes(user.role)) {
    return NextResponse.json({ error: 'This account role can only sign in on the web app.' }, { status: 403 })
  }

  return NextResponse.json({ ...await createMobileSession(user.id), user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar } })
}
