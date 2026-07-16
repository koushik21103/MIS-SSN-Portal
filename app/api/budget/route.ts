import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

// GET /api/budget?fyId=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId = req.nextUrl.searchParams.get('fyId')
  if (!fyId) return NextResponse.json({ error: 'fyId required' }, { status: 400 })

  const budgets = await prisma.budget.findMany({
    where: { financialYearId: fyId },
    include: { accountHead: true },
    orderBy: { accountHead: { sortOrder: 'asc' } },
  })

  // Also return the account heads (for heads with no budget yet)
  const heads = await prisma.accountHead.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ budgets, heads })
}

const budgetSchema = z.object({
  financialYearId: z.string(),
  accountHeadId:   z.string(),
  m1:  z.number().min(0).default(0),
  m2:  z.number().min(0).default(0),
  m3:  z.number().min(0).default(0),
  m4:  z.number().min(0).default(0),
  m5:  z.number().min(0).default(0),
  m6:  z.number().min(0).default(0),
  m7:  z.number().min(0).default(0),
  m8:  z.number().min(0).default(0),
  m9:  z.number().min(0).default(0),
  m10: z.number().min(0).default(0),
  m11: z.number().min(0).default(0),
  m12: z.number().min(0).default(0),
})

// POST /api/budget — upsert a budget row (Admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = budgetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { financialYearId, accountHeadId, ...months } = parsed.data

  const annual = Object.values(months).reduce((sum, v) => sum + v, 0)

  const budget = await prisma.budget.upsert({
    where: { financialYearId_accountHeadId: { financialYearId, accountHeadId } },
    update: { ...months, annualAmount: annual },
    create: { financialYearId, accountHeadId, ...months, annualAmount: annual },
  })

  return NextResponse.json(budget)
}
