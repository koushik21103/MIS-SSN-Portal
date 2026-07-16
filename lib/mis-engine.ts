/**
 * MIS Calculation Engine
 *
 * Implements the exact formulas from MIS 2026-2027.xlsx, verified
 * by extracting actual cell formulas from the Excel file.
 *
 * Key verified formulas:
 *  Allowed (e.g. C9):  = Actual!C$3/BUDGET!E$3*BUDGET!E9
 *  Allowed (indirect income, e.g. C23): = +BUDGET!E23  (FIXED — no proration)
 *  Variance: Allowed − Actual (for expenses), Actual − Allowed (for revenue)
 */

import type { AllowedType, HeadType } from '@prisma/client'

// ── Allowed ────────────────────────────────────────────────────────────────────
/**
 * Compute the "Allowed" value for a given account head and month.
 *
 * For ALL cost/expense items (PRORATED):
 *   Allowed = (Actual Total Sales / Budget Total Sales) × Budget Monthly Amount
 *
 * For Indirect Income items (FIXED — verified: Machine Rent EMI, Other Income):
 *   Allowed = Budget Monthly Amount  (no proration)
 *
 * @param allowedType  - 'PRORATED' | 'FIXED' from AccountHead
 * @param budgetAmount - Monthly budget for this line item
 * @param budgetRevenue - Total budget revenue for this month (BUDGET!E$3)
 * @param actualRevenue - Total actual revenue for this month (Actual!C$3)
 */
export function computeAllowed(
  allowedType: AllowedType,
  budgetAmount: number,
  budgetRevenue: number,
  actualRevenue: number,
): number {
  if (allowedType === 'FIXED') return budgetAmount
  if (budgetRevenue === 0) return budgetAmount // avoid division by zero
  return (actualRevenue / budgetRevenue) * budgetAmount
}

// ── Variance ───────────────────────────────────────────────────────────────────
/**
 * Compute the "Variance" value (Allowed − Actual for expenses, Actual − Allowed for revenue).
 *
 * Sign convention (matching Excel Variance sheet):
 *   Expenses: positive variance = under-spent (favorable)
 *   Revenue:  positive variance = over-achieved (favorable)
 */
export function computeVariance(
  allowed: number,
  actual: number,
  type: HeadType,
): number {
  return type === 'REVENUE' ? actual - allowed : allowed - actual
}

// ── YTD (Year-to-Date) ─────────────────────────────────────────────────────────
/**
 * Compute the Year-to-Date cumulative total up to (and including) the given month.
 *
 * @param monthlyValues - Record mapping month (1–12) to its value
 * @param upToMonth     - Include months 1 through upToMonth (inclusive)
 */
export function computeYTD(
  monthlyValues: Record<number, number>,
  upToMonth: number,
): number {
  return Array.from({ length: upToMonth }, (_, i) => monthlyValues[i + 1] ?? 0)
    .reduce((sum, v) => sum + v, 0)
}

// ── Percentage of Total Sales ──────────────────────────────────────────────────
/**
 * Compute a value as a percentage of total sales (matches the "% on Tot Sale" columns
 * in the MIS-P&L sheet).
 */
export function computePctOfSales(value: number, totalSales: number): number {
  if (totalSales === 0) return 0
  return value / totalSales
}

// ── P&L Row Aggregation ────────────────────────────────────────────────────────
export interface PLRow {
  accountHeadId:  string
  code:           string
  name:           string
  type:           HeadType
  allowedType:    AllowedType
  sortOrder:      number
  parentId:       string | null
  budget:         number
  actual:         number
  allowed:        number
  variance:       number
  budgetYTD:      number
  actualYTD:      number
  allowedYTD:     number
  varianceYTD:    number
  pctBudget:      number
  pctActual:      number
}

/**
 * Build a complete P&L for a given month from raw budget and actual data.
 *
 * @param month         - 1–12
 * @param budgetMap     - { accountHeadId: { m1…m12, annualAmount } }
 * @param actualMap     - { accountHeadId: { [month]: amount } }
 * @param heads         - All active AccountHead records
 * @param budgetRevenue - Monthly budget total sales for this month
 * @param actualRevenue - Monthly actual total sales for this month
 */
export function buildPLRows(params: {
  month:               number
  budgetMap:           Record<string, Record<string, number>>
  actualMap:           Record<string, Record<number, number>>
  heads:               Array<{ id: string; code: string; name: string; type: HeadType; allowedType: AllowedType; sortOrder: number; parentId: string | null }>
  budgetRevenue:       number   // monthly budget revenue for `month`
  actualRevenue:       number   // monthly actual revenue for `month`
  // Per-month revenues for proper YTD allowed proration (optional — falls back to monthly if absent)
  revenueHeadId?:      string
  perMonthBudgetRevenue?: Record<number, number>   // { 1: 5000, 2: 5200, … }
  perMonthActualRevenue?: Record<number, number>   // { 1: 4800, 2: 5100, … }
}): PLRow[] {
  const { month, budgetMap, actualMap, heads, budgetRevenue, actualRevenue,
          perMonthBudgetRevenue, perMonthActualRevenue } = params

  return heads.map(head => {
    const budgetRecord = budgetMap[head.id] ?? {}
    const actualRecord = actualMap[head.id] ?? {}

    const monthKey = `m${month}` as keyof typeof budgetRecord
    const budget   = (budgetRecord[monthKey] as number) ?? 0
    const actual   = actualRecord[month] ?? 0
    const allowed  = computeAllowed(head.allowedType, budget, budgetRevenue, actualRevenue)
    const variance = computeVariance(allowed, actual, head.type)

    // YTD: sum months 1 → current month
    const budgetYTD = computeYTD(
      Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, (budgetRecord[`m${i + 1}` as keyof typeof budgetRecord] as number) ?? 0])),
      month,
    )
    const actualYTD = computeYTD(actualRecord, month)

    // YTD allowed: sum per-month allowed values using per-month revenues (accurate proration)
    let allowedYTD = 0
    for (let m = 1; m <= month; m++) {
      const bAmt   = (budgetRecord[`m${m}` as keyof typeof budgetRecord] as number) ?? 0
      const bRev   = perMonthBudgetRevenue?.[m] ?? budgetRevenue
      const aRev   = perMonthActualRevenue?.[m] ?? (m === month ? actualRevenue : 0)
      allowedYTD  += computeAllowed(head.allowedType, bAmt, bRev, aRev)
    }
    const varianceYTD = computeVariance(allowedYTD, actualYTD, head.type)

    const pctBudget = computePctOfSales(budget, budgetRevenue)
    const pctActual = computePctOfSales(actual, actualRevenue)

    return {
      accountHeadId: head.id,
      code:          head.code,
      name:          head.name,
      type:          head.type,
      allowedType:   head.allowedType,
      sortOrder:     head.sortOrder,
      parentId:      head.parentId,
      budget,
      actual,
      allowed,
      variance,
      budgetYTD,
      actualYTD,
      allowedYTD,
      varianceYTD,
      pctBudget,
      pctActual,
    }
  }).sort((a, b) => a.sortOrder - b.sortOrder)
}

