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

    const additionsGte180 = movements
      .filter(m => m.type === 'ADDITION' && m.isGte180Days)
      .reduce((s, m) => s + Number(m.amount), 0)
    const additionsLt180 = movements
      .filter(m => m.type === 'ADDITION' && !m.isGte180Days)
      .reduce((s, m) => s + Number(m.amount), 0)
    const disposalsLt180 = movements
      .filter(m => m.type === 'DISPOSAL' && !m.isGte180Days)
      .reduce((s, m) => s + Number(m.amount), 0)
    const disposalsGte180 = movements
      .filter(m => m.type === 'DISPOSAL' && m.isGte180Days)
      .reduce((s, m) => s + Number(m.amount), 0)

    const openingWdv = Number(b.openingWdv)

    // Excel WDV formula: rate*(opening+addGte) + (addLt*rate/2) - (dispLt*rate) - (dispGte*rate/2)
    const annualDepr =
      rate * (openingWdv + additionsGte180) +
      (additionsLt180 * rate / 2) -
      (disposalsLt180 * rate) -
      (disposalsGte180 * rate / 2)

    const monthlyDepr = annualDepr / 12
    const closingWdv  = openingWdv - annualDepr

    return {
      assetId:          b.assetId,
      assetName:        b.asset.name,
      category:         b.asset.category,
      rateEnum:         b.asset.rateEnum,
      ratePct:          rate * 100,
      isActive:         b.asset.isActive,
      openingWdv,
      additionsGte180,
      additionsLt180,
      disposalsLt180,
      disposalsGte180,
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
