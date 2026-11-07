import { NextResponse } from 'next/server'
import { z } from 'zod'
import { revokeMobileSession } from '@/lib/mobile-auth'

const schema = z.object({ refreshToken: z.string().min(40).max(200) })

export async function POST(request: Request) {
  let input: z.infer<typeof schema>
  try { input = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'A valid refresh token is required.' }, { status: 400 }) }

  await revokeMobileSession(input.refreshToken)
  return NextResponse.json({ success: true })
}
