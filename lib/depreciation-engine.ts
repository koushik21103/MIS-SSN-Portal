/**
 * Depreciation Calculation Engine
 *
 * Implements the WDV formula from the Excel Depreciation sheet.
 * Verified against cell I5:
 *   = B5*(C5+D5) + (E5*B5/2) - (F5*B5/B5) - (G5*B5/2)
 * Where:
 *   B = Rate, C = OpeningWDV, D = Additions≥180d, E = Additions<180d
 *   F = Disposals<180d, G = Disposals≥180d
 *
 * Rates from Excel column B:
 *   FIFTEEN = 0.15 (Plant, Machinery, Furniture, Vehicles)
 *   FORTY   = 0.40 (Computers, Laptops, Printers)
 */

import type { PrismaClient, DepRate } from '@prisma/client'

export const RATE_MAP: Record<DepRate, number> = {
  FIFTEEN: 0.15,
  FORTY:   0.40,
}

// ── Broken-Period Monthly Pro-Rata Formula ──────────────────────────────────────
/**
 * Compute depreciation for additions and disposals based on the month added or disposed:
 * - Addition: remaining period of FY / 12 months (e.g., added in Oct = 6/12)
 * - Disposal/Sale: period up to sale / 12 months of that FY (e.g., disposed in Oct = 7/12)
 */
export function getBrokenPeriodMonths(date: Date): { monthsHeld: number; remainingMonths: number } {
  const monthIdx = date.getMonth() // 0 = Jan, 3 = Apr, 9 = Oct
  const monthsFromApril = monthIdx >= 3 ? monthIdx - 3 : monthIdx + 9
  const monthsHeld = monthsFromApril + 1 // Apr through addition/disposal month
  const remainingMonths = 12 - monthsFromApril // addition month through Mar
  return { monthsHeld, remainingMonths }
}

export function computeMonthlyDepreciation(annual: number): number {
  return annual / 12
}

export function computeHoldingDays(movementDate: Date, fyEndDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const days = Math.floor((fyEndDate.getTime() - movementDate.getTime()) / msPerDay)
  return Math.max(0, days)
}

export function isGte180Days(movementDate: Date, fyEndDate: Date): boolean {
  return computeHoldingDays(movementDate, fyEndDate) >= 180
}

// ── Per-Asset Depreciation Calculator ─────────────────────────────────────────
/**
 * Calculate annual and monthly depreciation for one asset in one financial year,
 * reading its balance and movements from the database with broken period calculation.
 */
export async function calculateAssetDepreciation(
  assetId:         string,
  financialYearId: string,
  _fyEndDate:      Date,
  prisma:          PrismaClient,
): Promise<{ annualDepr: number; monthlyDepr: number; closingWdv: number } | null> {
  const balance = await prisma.assetYearBalance.findUnique({
    where: { assetId_financialYearId: { assetId, financialYearId } },
    include: {
      asset: true,
    },
  })

  if (!balance) return null

  const movements = await prisma.assetMovement.findMany({
    where: { assetId, financialYearId },
  })

  const rate = RATE_MAP[balance.asset.rateEnum]

  let additionsDepr = 0
  let additionsTotal = 0
  let disposalsDepr = 0
  let disposalsTotal = 0

  movements.forEach(m => {
    const amt = Number(m.amount)
    const { monthsHeld, remainingMonths } = getBrokenPeriodMonths(new Date(m.date))

    if (m.type === 'ADDITION') {
      additionsTotal += amt
      additionsDepr += amt * rate * (remainingMonths / 12)
    } else if (m.type === 'DISPOSAL') {
      disposalsTotal += amt
      disposalsDepr += amt * rate * (monthsHeld / 12)
    }
  })

  const openingWdv = Number(balance.openingWdv)
  const baseWdv = Math.max(0, openingWdv - disposalsTotal)
  const baseDepr = baseWdv * rate
  const annualDepr = Math.max(0, baseDepr + additionsDepr + disposalsDepr)
  const monthlyDepr = annualDepr / 12
  const closingWdv = Math.max(0, openingWdv + additionsTotal - disposalsTotal - annualDepr)

  return { annualDepr, monthlyDepr, closingWdv }
}

// ── Year Rollover ──────────────────────────────────────────────────────────────
/**
 * Run at the start of a new financial year (April 1).
 *
 * For every active asset that has a closing WDV in the previous year:
 *   → Creates a new AssetYearBalance with openingWdv = previous year's closingWdv
 *
 * Assets marked isActive = false (disposed during the year) are excluded.
 * New assets added during the year automatically appear in next year's rollover
 * because they have an AssetYearBalance record for the current year.
 */
export async function rolloverDepreciation(
  closingYearId: string,
  newYearId:     string,
  prisma:        PrismaClient,
): Promise<{ rolledOver: number; skipped: number }> {
  const closingBalances = await prisma.assetYearBalance.findMany({
    where: {
      financialYearId: closingYearId,
      asset: { isActive: true },
    },
  })

  let rolledOver = 0
  let skipped    = 0

  for (const b of closingBalances) {
    const newOpeningWdv = b.closingWdv !== null ? Number(b.closingWdv) : Number(b.openingWdv)

    const existing = await prisma.assetYearBalance.findUnique({
      where: { assetId_financialYearId: { assetId: b.assetId, financialYearId: newYearId } },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.assetYearBalance.create({
      data: {
        assetId:         b.assetId,
        financialYearId: newYearId,
        openingWdv:      newOpeningWdv,
        annualDepr:      null,
        closingWdv:      null,
        monthlyDepr:     null,
      },
    })
    rolledOver++
  }

  return { rolledOver, skipped }
}
