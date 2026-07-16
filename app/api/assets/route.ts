import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { computeHoldingDays, isGte180Days } from '@/lib/depreciation-engine'

// GET /api/assets — list all assets with their current FY balance
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId = req.nextUrl.searchParams.get('fyId')
  if (!fyId) return NextResponse.json({ error: 'fyId required' }, { status: 400 })

  const assets = await prisma.asset.findMany({
    include: {
      yearBalances: { where: { financialYearId: fyId } },
      movements:   { where: { financialYearId: fyId }, orderBy: { date: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(assets)
}

// POST /api/assets — Admin only, create a new asset and its year balance
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, category, rateEnum, purchaseDate, openingWdv, financialYearId } = await req.json()

  if (!name || !category || !rateEnum || !purchaseDate || openingWdv == null || !financialYearId) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const asset = await prisma.asset.create({
    data: {
      name,
      category,
      rateEnum,
      purchaseDate: new Date(purchaseDate),
      yearBalances: {
        create: {
          financialYearId,
          openingWdv: parseFloat(openingWdv),
        },
      },
    },
    include: { yearBalances: true },
  })

  return NextResponse.json(asset, { status: 201 })
}

// PATCH /api/assets — Admin only, update asset name/category/isActive or record a movement
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Movement recording
  if (body.action === 'movement') {
    const { assetId, financialYearId, type, amount, date, notes } = body
    if (!assetId || !financialYearId || !type || !amount || !date) {
      return NextResponse.json({ error: 'assetId, financialYearId, type, amount, date required' }, { status: 400 })
    }

    const fy = await prisma.financialYear.findUnique({ where: { id: financialYearId } })
    if (!fy) return NextResponse.json({ error: 'FY not found' }, { status: 404 })

    const movDate = new Date(date)
    const holdDays  = computeHoldingDays(movDate, fy.endDate)
    const gte180    = isGte180Days(movDate, fy.endDate)

    const movement = await prisma.assetMovement.create({
      data: {
        assetId,
        financialYearId,
        type,
        amount:      parseFloat(amount),
        date:        movDate,
        holdingDays: holdDays,
        isGte180Days: gte180,
        notes:       notes ?? null,
      },
    })

    // If disposal, mark asset as inactive
    if (type === 'DISPOSAL') {
      await prisma.asset.update({ where: { id: assetId }, data: { isActive: false } })
    }

    return NextResponse.json(movement)
  }

  // Asset field update
  const { id, name, category, isActive } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updated = await prisma.asset.update({
    where: { id },
    data: {
      ...(name     !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json(updated)
}
