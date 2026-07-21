import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const fys = await prisma.financialYear.findMany({
      orderBy: { startDate: 'desc' },
      select: { id: true, label: true, isActive: true }
    })
    return NextResponse.json(fys)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
