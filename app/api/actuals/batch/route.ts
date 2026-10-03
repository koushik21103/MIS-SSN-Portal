import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const actualSchema = z.object({
  financialYearId: z.string(),
  accountHeadId: z.string(),
  month: z.number().int().min(1).max(12),
  amount: z.number(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['ADMIN', 'FINANCE'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = z.array(actualSchema).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const entries = parsed.data
  if (entries.length === 0) return NextResponse.json({ success: true })

  const { financialYearId, month } = entries[0]

  // Check period is not locked
  const period = await prisma.period.findUnique({
    where: { financialYearId_month: { financialYearId, month } },
  })
  if (period?.status === 'LOCKED') {
    return NextResponse.json({ error: 'Period is locked. Contact Admin to unlock.' }, { status: 409 })
  }

  // Linear Entry Validation
  if (month > 1) {
    const prevPeriod = await prisma.period.findUnique({
      where: { financialYearId_month: { financialYearId, month: month - 1 } }
    })
    if (!prevPeriod?.submittedAt) {
      return NextResponse.json({ error: `Cannot save entries for Month ${month}. Month ${month - 1} must be submitted first.` }, { status: 400 })
    }
  }

  // Upsert all and un-submit the period
  const txs = entries.map(entry => prisma.actual.upsert({
    where: {
      financialYearId_accountHeadId_month: {
        financialYearId: entry.financialYearId,
        accountHeadId: entry.accountHeadId,
        month: entry.month,
      }
    },
    update: { amount: entry.amount, notes: entry.notes || '' },
    create: {
      financialYearId: entry.financialYearId,
      accountHeadId: entry.accountHeadId,
      month: entry.month,
      amount: entry.amount,
      notes: entry.notes || '',
      enteredById: session.user.id,
    },
  })) as any[]

  await prisma.$transaction(txs)

  return NextResponse.json({ success: true })
}
