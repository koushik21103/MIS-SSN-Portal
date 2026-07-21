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
  baseAmount:      z.number().nullable().optional(),
  growthRate:      z.number().nullable().optional(),
  annualAmount:    z.number().optional(), // For manual entry without base/growth
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

  const { financialYearId, accountHeadId, baseAmount, growthRate, annualAmount } = parsed.data

  if (annualAmount == null) {
    return NextResponse.json({ error: 'annualAmount is required' }, { status: 400 })
  }

  const head = await prisma.accountHead.findUnique({ where: { id: accountHeadId } })
  if (!head) return NextResponse.json({ error: 'Account head not found' }, { status: 404 })

  const isStock = head.code === 'OPEN_STOCK' || head.code === 'CLOSE_STOCK'

  // Ensure two decimal precision
  const finalAnnual = Number(annualAmount.toFixed(2))
  
  // Split evenly into 12 months, let m12 absorb the rounding difference
  const monthlyVal = isStock ? 0 : Number((finalAnnual / 12).toFixed(2))
  const m12Val = isStock ? 0 : Number((finalAnnual - (monthlyVal * 11)).toFixed(2))

  const updateData = {
    baseAmount: null,
    growthRate: null,
    annualAmount: finalAnnual,
    m1: monthlyVal, m2: monthlyVal, m3: monthlyVal, m4: monthlyVal,
    m5: monthlyVal, m6: monthlyVal, m7: monthlyVal, m8: monthlyVal,
    m9: monthlyVal, m10: monthlyVal, m11: monthlyVal, m12: m12Val
  }

  const budget = await prisma.budget.upsert({
    where: { financialYearId_accountHeadId: { financialYearId, accountHeadId } },
    update: updateData,
    create: { financialYearId, accountHeadId, ...updateData },
  })

  return NextResponse.json(budget)
}
