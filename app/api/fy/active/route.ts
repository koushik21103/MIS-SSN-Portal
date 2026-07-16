import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// GET /api/fy/active — returns the currently active financial year
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fy = await prisma.financialYear.findFirst({ where: { isActive: true } })
  return NextResponse.json(fy)
}
