import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

// GET /api/periods?fyId=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId = req.nextUrl.searchParams.get('fyId')

  const periods = await prisma.period.findMany({
    where: fyId ? { financialYearId: fyId } : undefined,
    orderBy: { month: 'asc' },
  })

  return NextResponse.json(periods)
}

// PATCH /api/periods/:id — change period status (Admin only)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const schema = z.object({
    id:     z.string(),
    status: z.enum(['OPEN', 'PENDING_REVIEW', 'LOCKED']),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const period = await prisma.period.update({
    where: { id: parsed.data.id },
    data:  { status: parsed.data.status },
  })

  return NextResponse.json(period)
}
