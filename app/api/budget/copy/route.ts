import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * POST /api/budget/copy
 *
 * Copies all budget rows from one financial year to another.
 * Used by Admin to clone the previous year's budget as a starting point.
 *
 * Body: { sourceFyId: string; targetFyId: string; scalePct?: number }
 *   scalePct: optional scaling factor as percentage (e.g. 110 = 10% increase, defaults to 100)
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sourceFyId, targetFyId, scalePct = 100 } = await req.json()

  if (!sourceFyId || !targetFyId) {
    return NextResponse.json({ error: 'sourceFyId and targetFyId required' }, { status: 400 })
  }
  if (sourceFyId === targetFyId) {
    return NextResponse.json({ error: 'Source and target must differ' }, { status: 400 })
  }

  const scale = scalePct / 100

  const sourceBudgets = await prisma.budget.findMany({
    where: { financialYearId: sourceFyId },
  })

  if (sourceBudgets.length === 0) {
    return NextResponse.json({ error: 'No budget found in source FY' }, { status: 404 })
  }

  const upserts = sourceBudgets.map(b => {
    const scaled = (v: number) => +(v * scale).toFixed(2)
    const m1  = scaled(Number(b.m1))
    const m2  = scaled(Number(b.m2))
    const m3  = scaled(Number(b.m3))
    const m4  = scaled(Number(b.m4))
    const m5  = scaled(Number(b.m5))
    const m6  = scaled(Number(b.m6))
    const m7  = scaled(Number(b.m7))
    const m8  = scaled(Number(b.m8))
    const m9  = scaled(Number(b.m9))
    const m10 = scaled(Number(b.m10))
    const m11 = scaled(Number(b.m11))
    const m12 = scaled(Number(b.m12))
    const annual = m1+m2+m3+m4+m5+m6+m7+m8+m9+m10+m11+m12

    return prisma.budget.upsert({
      where: { financialYearId_accountHeadId: { financialYearId: targetFyId, accountHeadId: b.accountHeadId } },
      update: { annualAmount: annual, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12 },
      create: { financialYearId: targetFyId, accountHeadId: b.accountHeadId, annualAmount: annual, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12 },
    })
  })

  await prisma.$transaction(upserts)

  return NextResponse.json({
    copied: sourceBudgets.length,
    scalePct,
    sourceFyId,
    targetFyId,
  })
}
