import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['ADMIN', 'FINANCE'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const schema = z.object({
    financialYearId: z.string(),
    month: z.number().int().min(1).max(12),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { financialYearId, month } = parsed.data

  // Check if month has actuals
  const actualsCount = await prisma.actual.count({
    where: { financialYearId, month }
  })

  if (actualsCount === 0) {
    return NextResponse.json({ error: 'Cannot submit month without any actual entries.' }, { status: 400 })
  }

  const period = await prisma.period.update({
    where: { financialYearId_month: { financialYearId, month } },
    data: { 
      submittedAt: new Date(),
    }
  })

  return NextResponse.json(period)
}
