import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

export type NotificationItem = {
  id: string
  title: string
  message: string
  type: 'action' | 'info' | 'warning' | 'success'
  timestamp: string
  link?: string
  actionable?: boolean
  requestId?: string
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fyId = req.nextUrl.searchParams.get('fyId')
  const notifications: NotificationItem[] = []

  try {
    // 1. Pending asset edit/creation requests
    const pendingAssetReqs = await prisma.assetEditRequest.findMany({
      where: { status: 'PENDING', ...(fyId ? { financialYearId: fyId } : {}) },
      include: { requestedBy: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    for (const r of pendingAssetReqs) {
      notifications.push({
        id: `asset-req-${r.id}`,
        title: `Asset ${r.action.toLowerCase()}: Approval Required`,
        message: `Requested by ${r.requestedBy?.name ?? 'User'} (${r.requestedBy?.role ?? 'Staff'}). Action: ${r.action}`,
        type: 'action',
        timestamp: r.createdAt.toISOString(),
        link: '/dashboard/assets',
        actionable: ['ADMIN', 'CFO'].includes(session.user.role),
        requestId: r.id,
      })
    }

    // 2. Open periods status
    if (fyId) {
      const openPeriods = await prisma.period.findMany({
        where: { financialYearId: fyId, status: 'OPEN' },
        orderBy: { month: 'asc' },
      })

      if (openPeriods.length > 0) {
        const currentOpen = openPeriods[0]
        const mLabel = MONTH_NAMES[currentOpen.month - 1]
        notifications.push({
          id: `period-open-${currentOpen.id}`,
          title: `Month ${mLabel} Active for Actuals`,
          message: `${mLabel} period is open. Actuals entries can be submitted or edited.`,
          type: 'info',
          timestamp: new Date().toISOString(),
          link: '/dashboard/actuals',
        })
      }

      // Check if any period is pending review
      const pendingPeriods = await prisma.period.findMany({
        where: { financialYearId: fyId, status: 'PENDING_REVIEW' },
        orderBy: { month: 'asc' },
      })
      for (const pp of pendingPeriods) {
        notifications.push({
          id: `period-pending-${pp.id}`,
          title: `Month ${MONTH_NAMES[pp.month - 1]} Awaiting Approval`,
          message: `Actuals submitted for ${MONTH_NAMES[pp.month - 1]}. Review and lock the period.`,
          type: 'action',
          timestamp: pp.submittedAt?.toISOString() || new Date().toISOString(),
          link: '/dashboard/actuals',
        })
      }

      // Check if any period is locked
      const lockedPeriods = await prisma.period.findMany({
        where: { financialYearId: fyId, status: 'LOCKED' },
        orderBy: { month: 'desc' },
        take: 1,
      })
      if (lockedPeriods.length > 0) {
        const lastLocked = lockedPeriods[0]
        notifications.push({
          id: `period-locked-${lastLocked.id}`,
          title: `Month ${MONTH_NAMES[lastLocked.month - 1]} Locked`,
          message: `Books closed for ${MONTH_NAMES[lastLocked.month - 1]}. Verified and locked.`,
          type: 'success',
          timestamp: new Date().toISOString(),
          link: '/dashboard/mis',
        })
      }
    }

    // 3. General system status
    const activeFy = await prisma.financialYear.findFirst({ where: { isActive: true } })
    if (activeFy) {
      notifications.push({
        id: `fy-active-${activeFy.id}`,
        title: `Financial Year Active`,
        message: `Currently operating under ${activeFy.label}.`,
        type: 'info',
        timestamp: activeFy.startDate.toISOString(),
      })
    }

    const unreadCount = notifications.filter(n => n.type === 'action').length

    return NextResponse.json({
      notifications,
      unreadCount,
    })
  } catch (err: any) {
    console.error('Error fetching notifications:', err)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}
