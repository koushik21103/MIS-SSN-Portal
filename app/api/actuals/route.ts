import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

// GET /api/actuals?fyId=xxx&month=4
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId  = req.nextUrl.searchParams.get('fyId')
  const month = req.nextUrl.searchParams.get('month')

  if (!fyId) return NextResponse.json({ error: 'fyId required' }, { status: 400 })

  const where: any = { financialYearId: fyId }
  if (month) where.month = parseInt(month)

  const actuals = await prisma.actual.findMany({
    where,
    include: { accountHead: true },
    orderBy: [{ month: 'asc' }, { accountHead: { sortOrder: 'asc' } }],
  })

  return NextResponse.json(actuals)
}

const actualSchema = z.object({
  financialYearId: z.string(),
  accountHeadId:   z.string(),
  month:           z.number().int().min(1).max(12),
  amount:          z.number(),
  notes:           z.string().optional(),
})

// POST /api/actuals — upsert an actual entry (Admin or Finance)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['ADMIN', 'FINANCE'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = actualSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { financialYearId, accountHeadId, month, amount, notes } = parsed.data

  // Check period is not locked
  const period = await prisma.period.findUnique({
    where: { financialYearId_month: { financialYearId, month } },
  })
  if (period?.status === 'LOCKED') {
    return NextResponse.json({ error: 'Period is locked. Contact Admin to unlock.' }, { status: 409 })
  }

  const actual = await prisma.actual.upsert({
    where: { financialYearId_accountHeadId_month: { financialYearId, accountHeadId, month } },
    update: { amount, notes: notes ?? null, enteredById: session.user.id },
    create: { financialYearId, accountHeadId, month, amount, notes: notes ?? null, enteredById: session.user.id },
  })

  return NextResponse.json(actual)
}
