import { NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile-auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const user = await getMobileUser(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })
  }

  const staff = user.role === 'teacher' ? await db.staff.findUnique({ where: { userId: user.id }, select: { id: true } }) : null
  if (user.role === 'teacher' && !staff) return NextResponse.json({ classes: [] })

  const classes = await db.class.findMany({
    where: staff ? { teachers: { some: { staffId: staff.id } } } : undefined,
    select: {
      id: true, name: true, code: true, subject: true, yearLevel: true,
      enrolments: {
        where: { status: 'active' },
        select: { student: { select: { id: true, studentId: true, yearLevel: true, user: { select: { name: true } } } } },
        orderBy: { student: { user: { name: 'asc' } } },
      },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ classes })
}
