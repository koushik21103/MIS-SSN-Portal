import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { RATE_MAP } from '@/lib/depreciation-engine'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 401 })
  }

  // 1. Get the current active year
  const currentFy = await prisma.financialYear.findFirst({
    where: { isActive: true }
  })
  if (!currentFy) {
    return NextResponse.json({ error: 'No active financial year found' }, { status: 400 })
  }

  // Parse years (e.g. "2026-2027")
  const [startYearStr, endYearStr] = currentFy.label.split('-')
  const startYear = parseInt(startYearStr)
  const endYear = parseInt(endYearStr)
  const nextStart = startYear + 1
  const nextEnd = endYear + 1
  const nextLabel = `${nextStart}-${nextEnd}`

  // Ensure it doesn't already exist
  const existingNext = await prisma.financialYear.findUnique({
    where: { label: nextLabel }
  })
  if (existingNext) {
    return NextResponse.json({ error: `Financial year ${nextLabel} already exists` }, { status: 400 })
  }

  const newStartDate = new Date(`${nextStart}-04-01T00:00:00.000Z`)
  const newEndDate = new Date(`${nextEnd}-03-31T23:59:59.999Z`)

  try {
    // We do this in a transaction if possible, or sequentially since there are complex lookups
    // A) Create new FY & Periods
    const newFy = await prisma.financialYear.create({
      data: {
        label: nextLabel,
        startDate: newStartDate,
        endDate: newEndDate,
        isActive: false, // We'll swap it at the end
        periods: {
          create: Array.from({ length: 12 }).map((_, i) => ({
            month: i + 1,
            status: 'OPEN'
          }))
        }
      }
    })

    // B) Rollover Depreciation
    const oldBalances = await prisma.assetYearBalance.findMany({
      where: { financialYearId: currentFy.id },
      include: {
        asset: {
          include: { movements: { where: { financialYearId: currentFy.id } } }
        }
      }
    })

    const newBalances = oldBalances.map(b => {
      const rate = RATE_MAP[b.asset.rateEnum as keyof typeof RATE_MAP] || 0
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
      let closingWdv = openingWdv + additionsTotal - disposalsTotal - annualDepr
      if (closingWdv < 0) closingWdv = 0

      return {
        assetId: b.assetId,
        financialYearId: newFy.id,
        openingWdv: closingWdv
      }
    })


    if (newBalances.length > 0) {
      await prisma.assetYearBalance.createMany({ data: newBalances })
    }

    // C) Rollover Stock
    const closeStockHead = await prisma.accountHead.findUnique({ where: { code: 'CLOSE_STOCK' } })
    const openStockHead = await prisma.accountHead.findUnique({ where: { code: 'OPEN_STOCK' } })
    
    if (closeStockHead && openStockHead) {
      const marchCloseStock = await prisma.actual.findUnique({
        where: {
          financialYearId_accountHeadId_month: {
            financialYearId: currentFy.id,
            accountHeadId: closeStockHead.id,
            month: 12
          }
        }
      })
      if (marchCloseStock && Number(marchCloseStock.amount) > 0) {
        await prisma.actual.create({
          data: {
            financialYearId: newFy.id,
            accountHeadId: openStockHead.id,
            month: 1,
            amount: marchCloseStock.amount,
            enteredById: session.user.id,
            notes: 'Rollover from previous year'
          }
        })
      }
    }

    // D) Swap Active Status
    await prisma.$transaction([
      prisma.financialYear.update({
        where: { id: currentFy.id },
        data: { isActive: false }
      }),
      prisma.financialYear.update({
        where: { id: newFy.id },
        data: { isActive: true }
      })
    ])

    return NextResponse.json({ success: true, newFy })
  } catch (error: any) {
    console.error('Rollover error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
