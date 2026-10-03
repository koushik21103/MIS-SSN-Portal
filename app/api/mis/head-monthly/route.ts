import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { computeAllowed, computeVariance } from '@/lib/mis-engine'

const MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

/**
 * GET /api/mis/head-monthly?fyId=xxx&headId=yyy
 *
 * Returns 12-month comparison (all 12 months at the same time) for the selected account head:
 *   - budget
 *   - actual
 *   - allowed
 *   - variance
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId = req.nextUrl.searchParams.get('fyId')
  const headId = req.nextUrl.searchParams.get('headId')

  if (!fyId || !headId) {
    return NextResponse.json({ error: 'fyId and headId are required' }, { status: 400 })
  }

  const head = await prisma.accountHead.findUnique({
    where: { id: headId },
  })
  if (!head) return NextResponse.json({ error: 'Account head not found' }, { status: 404 })

  // Fetch sales total & revenue heads for proration
  const salesTotal = await prisma.accountHead.findFirst({ where: { code: 'SALES_TOTAL' } })
  const revenueHeads = salesTotal
    ? await prisma.accountHead.findMany({ where: { parentId: salesTotal.id, isActive: true } })
    : []
  const revenueHeadIds = revenueHeads.map(h => h.id)

  // Fetch all budgets for this FY
  const budgets = await prisma.budget.findMany({
    where: { financialYearId: fyId },
  })
  const budgetMap: Record<string, Record<string, number>> = {}
  for (const b of budgets) {
    budgetMap[b.accountHeadId] = {
      m1: Number(b.m1), m2: Number(b.m2), m3: Number(b.m3),
      m4: Number(b.m4), m5: Number(b.m5), m6: Number(b.m6),
      m7: Number(b.m7), m8: Number(b.m8), m9: Number(b.m9),
      m10: Number(b.m10), m11: Number(b.m11), m12: Number(b.m12),
      annualAmount: Number(b.annualAmount),
    }
  }

  // Fetch actuals for this FY
  const actuals = await prisma.actual.findMany({
    where: { financialYearId: fyId },
  })
  const actualMap: Record<string, Record<number, number>> = {}
  for (const a of actuals) {
    if (!actualMap[a.accountHeadId]) actualMap[a.accountHeadId] = {}
    actualMap[a.accountHeadId][a.month] = Number(a.amount)
  }

  // Get total monthly revenue
  const getBudRev = (m: number) => {
    return revenueHeadIds.reduce((sum, id) => sum + (budgetMap[id]?.[`m${m}`] || 0), 0)
  }
  const getActRev = (m: number) => {
    return revenueHeadIds.reduce((sum, id) => sum + (actualMap[id]?.[m] || 0), 0)
  }

  const headBudget = budgetMap[head.id] || {}
  const headActuals = actualMap[head.id] || {}

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1
    const budgetVal = headBudget[`m${monthNum}`] || 0
    const actualVal = headActuals[monthNum] || 0
    const budRev = getBudRev(monthNum)
    const actRev = getActRev(monthNum)

    const allowedVal = head.type === 'REVENUE'
      ? budgetVal
      : computeAllowed(head.allowedType, budgetVal, actualVal, budRev, actRev)

    const varVal = computeVariance(allowedVal, actualVal, head.type)

    return {
      month: monthNum,
      label: MONTH_NAMES[i],
      budget: budgetVal,
      actual: actualVal,
      allowed: allowedVal,
      variance: varVal,
    }
  })

  return NextResponse.json({
    accountHead: {
      id: head.id,
      code: head.code,
      name: head.name,
      type: head.type,
      allowedType: head.allowedType,
    },
    months,
  })
}
