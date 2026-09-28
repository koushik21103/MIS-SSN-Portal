import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { RATE_MAP } from '@/lib/depreciation-engine'

/**
 * GET /api/depreciation?fyId=xxx
 *
 * Returns the full depreciation schedule for all active assets in a FY.
 * Movements (additions/disposals) belong to Asset.movements, filtered by financialYearId.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId = req.nextUrl.searchParams.get('fyId')
  if (!fyId) return NextResponse.json({ error: 'fyId required' }, { status: 400 })

  const fy = await prisma.financialYear.findUnique({ where: { id: fyId } })
  if (!fy) return NextResponse.json({ error: 'Financial year not found' }, { status: 404 })

  // Fetch all asset year balances with asset details AND asset's movements for this FY
  const balances = await prisma.assetYearBalance.findMany({
    where: { financialYearId: fyId },
    include: {
      asset: {
        include: {
          // Only movements for this financial year
          movements: {
            where: { financialYearId: fyId },
          },
        },
      },
    },
    orderBy: { asset: { name: 'asc' } },
  })

  const schedule = balances.map(b => {
    const rate      = RATE_MAP[b.asset.rateEnum]
    const movements = b.asset.movements

    let additionsDepr = 0
    let additionsTotal = 0
    let disposalsDepr = 0
    let disposalsTotal = 0

    movements.forEach(m => {
      const amt = Number(m.amount)
      const d = new Date(m.date)
      const monthIdx = d.getMonth()
      const monthsFromApril = monthIdx >= 3 ? monthIdx - 3 : monthIdx + 9
      const monthsHeld = monthsFromApril + 1
      const remainingMonths = 12 - monthsFromApril

      if (m.type === 'ADDITION') {
        additionsTotal += amt
        additionsDepr += amt * rate * (remainingMonths / 12)
      } else if (m.type === 'DISPOSAL') {
        disposalsTotal += amt
        disposalsDepr += amt * rate * (monthsHeld / 12)
      }
    })

    const openingWdv = Number(b.openingWdv)
    const baseWdv = Math.max(0, openingWdv - disposalsTotal)
    const baseDepr = baseWdv * rate

    const annualDepr = baseDepr + additionsDepr + disposalsDepr
    const monthlyDepr = annualDepr / 12
    const closingWdv = openingWdv + additionsTotal - disposalsTotal - annualDepr

    return {
      assetId:          b.assetId,
      assetName:        b.asset.name,
      category:         b.asset.category,
      rateEnum:         b.asset.rateEnum,
      ratePct:          rate * 100,
      isActive:         b.asset.isActive,
      openingWdv,
      additionsTotal,
      disposalsTotal,
      annualDepr:       Math.max(0, annualDepr),
      monthlyDepr:      Math.max(0, monthlyDepr),
      closingWdv:       Math.max(0, closingWdv),
      movementsCount:   movements.length,
    }
  })

  const totalOpeningWdv  = schedule.reduce((s, r) => s + r.openingWdv, 0)
  const totalAnnualDepr  = schedule.reduce((s, r) => s + r.annualDepr, 0)
  const totalMonthlyDepr = schedule.reduce((s, r) => s + r.monthlyDepr, 0)
  const totalClosingWdv  = schedule.reduce((s, r) => s + r.closingWdv, 0)

  return NextResponse.json({
    fyId,
    fyLabel: fy.label,
    schedule,
    totals: { totalOpeningWdv, totalAnnualDepr, totalMonthlyDepr, totalClosingWdv },
  })
}
