import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { runFeeReminders } from '@/lib/fee-reminders'

// Schedulers must send Authorization: Bearer <CRON_SECRET>. The admin UI uses
// its separately authenticated server action in the Finance module.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Cron endpoint is not configured.' }, { status: 503 })
  }

  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(req.headers.get('authorization') ?? '')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(await runFeeReminders())
}
