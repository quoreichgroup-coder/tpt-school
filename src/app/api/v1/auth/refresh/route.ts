import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rotateMobileSession } from '@/lib/mobile-auth'

const schema = z.object({ refreshToken: z.string().min(40).max(200) })

export async function POST(request: Request) {
  let input: z.infer<typeof schema>
  try { input = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'A valid refresh token is required.' }, { status: 400 }) }

  const session = await rotateMobileSession(input.refreshToken)
  if (!session) return NextResponse.json({ error: 'Refresh token expired or revoked.' }, { status: 401 })
  return NextResponse.json(session)
}
