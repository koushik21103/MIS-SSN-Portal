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

// ── Core WDV Formula ───────────────────────────────────────────────────────────
/**
 * Compute annual depreciation for a single asset for a given financial year.
 * Exactly mirrors the Excel formula in column I of the Depreciation sheet.
 */
export function computeAnnualDepreciation(params: {
  rate:            number  // 0.15 or 0.40
  openingWdv:      number  // AssetYearBalance.openingWdv
  additionsGte180: number  // sum of ADDITION movements where isGte180Days = true
  additionsLt180:  number  // sum of ADDITION movements where isGte180Days = false
  disposalsLt180:  number  // sum of DISPOSAL movements where isGte180Days = false
  disposalsGte180: number  // sum of DISPOSAL movements where isGte180Days = true
}): number {
  const { rate, openingWdv, additionsGte180, additionsLt180,
          disposalsLt180, disposalsGte180 } = params

  return (
    rate * (openingWdv + additionsGte180)
    + (additionsLt180  * rate / 2)   // half rate: purchased late in year
    - (disposalsLt180  * rate)        // full rate subtracted: disposed early
    - (disposalsGte180 * rate / 2)    // half rate subtracted: disposed late
  )
}

export function computeMonthlyDepreciation(annual: number): number {
  return annual / 12
}

// ── Holding Days Calculation ───────────────────────────────────────────────────
/**
 * Compute how many days an asset movement (addition/disposal) date
 * falls before the financial year end (March 31).
 *
 * Used to classify movement as <180 days or ≥180 days,
 * which determines the depreciation rate applied.
 */
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
 * reading its balance and movements from the database.
 */
export async function calculateAssetDepreciation(
  assetId:         string,
  financialYearId: string,
  fyEndDate:       Date,
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

  const additionsGte180 = movements
    .filter(m => m.type === 'ADDITION' && m.isGte180Days)
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const additionsLt180 = movements
    .filter(m => m.type === 'ADDITION' && !m.isGte180Days)
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const disposalsLt180 = movements
    .filter(m => m.type === 'DISPOSAL' && !m.isGte180Days)
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const disposalsGte180 = movements
    .filter(m => m.type === 'DISPOSAL' && m.isGte180Days)
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const annualDepr = computeAnnualDepreciation({
    rate,
    openingWdv:      Number(balance.openingWdv),
    additionsGte180,
    additionsLt180,
    disposalsLt180,
    disposalsGte180,
  })

  const monthlyDepr = computeMonthlyDepreciation(annualDepr)
  const closingWdv  = Number(balance.openingWdv) - annualDepr

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
