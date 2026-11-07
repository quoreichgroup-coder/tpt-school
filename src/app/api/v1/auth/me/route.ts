import { NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  const user = await getMobileUser(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  return NextResponse.json({ user })
}
