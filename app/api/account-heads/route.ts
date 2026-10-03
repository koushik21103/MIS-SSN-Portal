import { NextRequest, NextResponse } from 'next/server'
import { HeadType, Segment, AllowedType } from '@prisma/client'
import { prisma } from '@/lib/db'

// Create a new AccountHead
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, parentId, type, segment = 'CONSOLIDATED', allowedType = 'PRORATED' } = body

    if (!name || !parentId || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the parent to determine base sorting
    const parent = await prisma.accountHead.findUnique({ where: { id: parentId } })
    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
    }

    // Find the highest sortOrder among existing children
    const children = await prisma.accountHead.findMany({
      where: { parentId },
      orderBy: { sortOrder: 'desc' },
      take: 1
    })
    
    let nextSortOrder = parent.sortOrder + 1
    if (children.length > 0) {
      nextSortOrder = children[0].sortOrder + 1
    }

    const uniqueCode = `CUSTOM_${Date.now()}_${Math.floor(Math.random() * 1000)}`

    const newHead = await prisma.accountHead.create({
      data: {
        name,
        code: uniqueCode,
        type: type as HeadType,
        segment: segment as Segment,
        allowedType: allowedType as AllowedType,
        sortOrder: nextSortOrder,
        parentId
      }
    })

    return NextResponse.json({ head: newHead })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Update an existing AccountHead (e.g. rename)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name } = body

    if (!id || !name) {
      return NextResponse.json({ error: 'Missing id or name' }, { status: 400 })
    }

    const updated = await prisma.accountHead.update({
      where: { id },
      data: { name }
    })

    return NextResponse.json({ head: updated })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Delete an AccountHead
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    // Delete related budgets and actuals first to avoid FK constraints
    await prisma.budget.deleteMany({ where: { accountHeadId: id } })
    await prisma.actual.deleteMany({ where: { accountHeadId: id } })

    const deleted = await prisma.accountHead.delete({
      where: { id }
    })

    return NextResponse.json({ head: deleted })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
