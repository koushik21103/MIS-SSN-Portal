import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { buildPLRows } from '@/lib/mis-engine'

/**
 * GET /api/mis/pl?fyId=xxx&month=4
 *
 * Returns the full P&L for a given month with:
 *   - Budget (monthly)
 *   - Actual (monthly)
 *   - Allowed = (Actual Sales / Budget Sales) × Budget Amount   [PRORATED]
 *   - Allowed = Budget Amount                                   [FIXED]
 *   - Variance = Allowed − Actual (expenses) / Actual − Allowed (revenue)
 *   - YTD Budget, YTD Actual, YTD Allowed (per-month proration), YTD Variance
 *   - % on Total Sales (Budget and Actual)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId  = req.nextUrl.searchParams.get('fyId')
  const month = parseInt(req.nextUrl.searchParams.get('month') ?? '1')

  if (!fyId || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'fyId and valid month (1–12) required' }, { status: 400 })
  }

  // ── Fetch all active account heads ─────────────────────────────────────────
  const heads = await prisma.accountHead.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  // ── Fetch all budget rows for this FY ──────────────────────────────────────
  const budgets = await prisma.budget.findMany({
    where: { financialYearId: fyId },
  })

  const budgetMap: Record<string, Record<string, number>> = {}
  for (const b of budgets) {
    budgetMap[b.accountHeadId] = {
      m1:  Number(b.m1),  m2:  Number(b.m2),  m3:  Number(b.m3),
      m4:  Number(b.m4),  m5:  Number(b.m5),  m6:  Number(b.m6),
      m7:  Number(b.m7),  m8:  Number(b.m8),  m9:  Number(b.m9),
      m10: Number(b.m10), m11: Number(b.m11), m12: Number(b.m12),
      annualAmount: Number(b.annualAmount),
    }
  }

  // ── Fetch all actuals for this FY (months 1 → selected month) ────────────
  const actuals = await prisma.actual.findMany({
    where: { financialYearId: fyId, month: { lte: month } },
  })

  const actualMap: Record<string, Record<number, number>> = {}
  for (const a of actuals) {
    if (!actualMap[a.accountHeadId]) actualMap[a.accountHeadId] = {}
    actualMap[a.accountHeadId][a.month] = Number(a.amount)
  }

  // ── Revenue head for proration ─────────────────────────────────────────────
  const revenueHead = heads.find(h => h.code === 'SALES_TOTAL')

  // Monthly budget revenue for selected month
  const budgetRevenue = revenueHead
    ? ((budgetMap[revenueHead.id] ?? {})[`m${month}`] ?? 0)
    : 0
  // Monthly actual revenue for selected month
  const actualRevenue = revenueHead
    ? (actualMap[revenueHead.id]?.[month] ?? 0)
    : 0

  // ── Per-month revenue for YTD allowed proration ────────────────────────────
  const perMonthBudgetRevenue: Record<number, number> = {}
  const perMonthActualRevenue: Record<number, number> = {}
  if (revenueHead) {
    for (let m = 1; m <= month; m++) {
      perMonthBudgetRevenue[m] = (budgetMap[revenueHead.id] ?? {})[`m${m}`] ?? 0
      perMonthActualRevenue[m] = actualMap[revenueHead.id]?.[m] ?? 0
    }
  }

  // ── Build P&L rows ─────────────────────────────────────────────────────────
  const rows = buildPLRows({
    month,
    budgetMap,
    actualMap,
    heads: heads.map(h => ({
      id:          h.id,
      code:        h.code,
      name:        h.name,
      type:        h.type,
      allowedType: h.allowedType,
      sortOrder:   h.sortOrder,
      parentId:    h.parentId,
    })),
    budgetRevenue,
    actualRevenue,
    perMonthBudgetRevenue,
    perMonthActualRevenue,
  })

  return NextResponse.json({
    month,
    fyId,
    budgetRevenue,
    actualRevenue,
    rows,
  })
}
