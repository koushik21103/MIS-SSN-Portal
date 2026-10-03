import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * GET /api/assets/edit-request?fyId=xxx
 * Returns all pending asset edit requests for review (Admin only)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId = req.nextUrl.searchParams.get('fyId')
  const all = await prisma.assetEditRequest.findMany({
    where: fyId ? { financialYearId: fyId } : {},
    include: { requestedBy: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(all)
}

/**
 * POST /api/assets/edit-request
 * Any authenticated user can submit a request. Admin/CFO can auto-approve.
 * Body: { financialYearId, assetId?, action: "CREATE"|"UPDATE"|"DELETE", payload: {...} }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { financialYearId, assetId, action, payload } = body

  if (!financialYearId || !action || !payload) {
    return NextResponse.json({ error: 'financialYearId, action, and payload are required' }, { status: 400 })
  }

  const request = await prisma.assetEditRequest.create({
    data: {
      financialYearId,
      assetId: assetId ?? null,
      action,
      payload: JSON.stringify(payload),
      status: 'PENDING',
      requestedById: session.user.id,
    },
  })

  return NextResponse.json(request, { status: 201 })
}

/**
 * PATCH /api/assets/edit-request
 * Admin only: approve or reject a request
 * Body: { requestId, decision: "APPROVED"|"REJECTED" }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !['ADMIN', 'CFO'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden – Admin or CFO only' }, { status: 403 })
  }

  const { requestId, decision } = await req.json()
  if (!requestId || !['APPROVED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'requestId and decision (APPROVED|REJECTED) required' }, { status: 400 })
  }

  const editReq = await prisma.assetEditRequest.findUnique({ where: { id: requestId } })
  if (!editReq) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (editReq.status !== 'PENDING') return NextResponse.json({ error: 'Already resolved' }, { status: 400 })

  // Update status
  const updated = await prisma.assetEditRequest.update({
    where: { id: requestId },
    data: { status: decision },
  })

  if (decision === 'APPROVED') {
    const p = JSON.parse(editReq.payload)
    if (editReq.action === 'CREATE') {
      // Create the asset + year balance
      await prisma.asset.create({
        data: {
          name: p.name,
          category: p.category,
          rateEnum: p.rateEnum,
          purchaseDate: new Date(p.purchaseDate),
          yearBalances: {
            create: { financialYearId: editReq.financialYearId, openingWdv: parseFloat(p.openingWdv) ?? 0 },
          },
        },
      })
    } else if (editReq.action === 'UPDATE' && editReq.assetId) {
      const updateData: Record<string, unknown> = {}
      if (p.name)         updateData.name = p.name
      if (p.category)     updateData.category = p.category
      if (p.rateEnum)     updateData.rateEnum = p.rateEnum
      if (p.purchaseDate) updateData.purchaseDate = new Date(p.purchaseDate)
      if (p.isActive !== undefined) updateData.isActive = p.isActive
      await prisma.asset.update({ where: { id: editReq.assetId }, data: updateData })

      if (p.openingWdv !== undefined) {
        await prisma.assetYearBalance.updateMany({
          where: { assetId: editReq.assetId, financialYearId: editReq.financialYearId },
          data: { openingWdv: parseFloat(p.openingWdv) },
        })
      }
    } else if (editReq.action === 'DELETE' && editReq.assetId) {
      await prisma.asset.update({ where: { id: editReq.assetId }, data: { isActive: false } })
    }
  }

  return NextResponse.json(updated)
}
