import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'Overview' }

function formatCurrency(val: number) {
  if (Math.abs(val) >= 1_00_00_000) return `₹${(val / 1_00_00_000).toFixed(2)}Cr`
  if (Math.abs(val) >= 1_00_000)    return `₹${(val / 1_00_000).toFixed(2)}L`
  return `₹${val.toLocaleString('en-IN')}`
}

export default async function DashboardPage() {
  const session = await auth()
  const role = session?.user?.role

  // Fetch active financial year
  const fy = await prisma.financialYear.findFirst({ where: { isActive: true } })

  // Fetch basic stats
  const [budgetCount, actualCount, assetCount, headCount] = await Promise.all([
    prisma.budget.count({ where: fy ? { financialYearId: fy.id } : {} }),
    prisma.actual.count({ where: fy ? { financialYearId: fy.id } : {} }),
    prisma.asset.count({ where: { isActive: true } }),
    prisma.accountHead.count({ where: { isActive: true } }),
  ])

  // Get revenue totals from Budget + Actuals
  const revenueHead = await prisma.accountHead.findFirst({ where: { code: 'SALES_TOTAL' } })
  const [budgetRevenue, actualRevenue] = await Promise.all([
    revenueHead && fy
      ? prisma.budget.findFirst({
          where: { financialYearId: fy.id, accountHeadId: revenueHead.id },
        })
      : null,
    revenueHead && fy
      ? prisma.actual.aggregate({
          where: { financialYearId: fy.id, accountHeadId: revenueHead.id },
          _sum: { amount: true },
        })
      : null,
  ])

  const budgetAnnual = budgetRevenue ? Number(budgetRevenue.annualAmount) : 0
  const actualYTD    = actualRevenue?._sum?.amount ? Number(actualRevenue._sum.amount) : 0
  const achievedPct  = budgetAnnual > 0 ? (actualYTD / budgetAnnual) * 100 : 0

  // Open periods count
  const openPeriods = await prisma.period.count({
    where: fy ? { financialYearId: fy.id, status: 'OPEN' } : {},
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">
          {fy ? `Financial Year ${fy.label}` : 'No active financial year'} · Welcome back, {session?.user?.name}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">Annual Budget (Revenue)</p>
          <p className="kpi-value">{formatCurrency(budgetAnnual)}</p>
          <p className="kpi-sub">
            <span>FY {fy?.label}</span>
          </p>
        </div>

        <div className="kpi-card">
          <p className="kpi-label">Actual Revenue (YTD)</p>
          <p className="kpi-value">{formatCurrency(actualYTD)}</p>
          <p className="kpi-sub">
            <span className={achievedPct >= 100 ? 'kpi-positive' : achievedPct >= 75 ? '' : 'kpi-negative'}>
              {achievedPct.toFixed(1)}% of annual budget
            </span>
          </p>
        </div>

        <div className="kpi-card">
          <p className="kpi-label">Active Assets</p>
          <p className="kpi-value">{assetCount}</p>
          <p className="kpi-sub">
            <span>In depreciation register</span>
          </p>
        </div>

        <div className="kpi-card">
          <p className="kpi-label">Open Periods</p>
          <p className="kpi-value">{openPeriods}</p>
          <p className="kpi-sub">
            <span className={openPeriods > 0 ? 'kpi-positive' : 'kpi-negative'}>
              of 12 months this FY
            </span>
          </p>
        </div>
      </div>

      {/* Quick actions based on role */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card">
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            System Status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Financial Year',  value: fy?.label ?? '—', ok: !!fy },
              { label: 'Account Heads',   value: `${headCount} configured`, ok: headCount > 0 },
              { label: 'Budget Lines',    value: `${budgetCount} entered`,  ok: budgetCount > 0 },
              { label: 'Actual Entries',  value: `${actualCount} recorded`, ok: actualCount > 0 },
              { label: 'Asset Register',  value: `${assetCount} assets`,    ok: assetCount > 0 },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span style={{ color: item.ok ? 'var(--green-400)' : 'var(--red-400)', fontWeight: 500 }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Quick Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(role === 'ADMIN' || role === 'FINANCE') && (
              <a href="/dashboard/actuals" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Enter Actuals
              </a>
            )}
            {role === 'ADMIN' && (
              <a href="/dashboard/budget" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="15" height="15"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Manage Budget
              </a>
            )}
            <a href="/dashboard/mis" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="15" height="15"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
              View MIS P&amp;L
            </a>
            <a href="/dashboard/depreciation" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="15" height="15"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              Asset Register
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
