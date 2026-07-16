'use client'

import { useState, useEffect } from 'react'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

type PLRow = {
  accountHeadId: string; code: string; name: string; type: string
  allowedType: string; sortOrder: number; parentId: string | null
  budget: number; actual: number; allowed: number; variance: number
  budgetYTD: number; actualYTD: number; allowedYTD: number; varianceYTD: number
  pctBudget: number; pctActual: number
}

function fmtCr(n: number) {
  if (n === 0) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_00_00_000) return `${n < 0 ? '-' : ''}${(abs / 1_00_00_000).toFixed(2)}Cr`
  if (abs >= 1_00_000)    return `${n < 0 ? '-' : ''}${(abs / 1_00_000).toFixed(2)}L`
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  if (!n || !isFinite(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

const TYPE_SECTIONS = [
  { type: 'REVENUE',          label: 'Sales / Revenue',    subtotal: 'SALES_TOTAL' },
  { type: 'COGS',             label: 'Cost of Sales',       subtotal: 'COGS_TOTAL'  },
  { type: 'DIRECT_EXPENSE',   label: 'Direct Expenses',     subtotal: 'DIREXP_TOTAL' },
  { type: 'INDIRECT_INCOME',  label: 'Indirect Income',     subtotal: 'INDINC_TOTAL' },
  { type: 'INDIRECT_EXPENSE', label: 'Indirect Expenses',   subtotal: 'INDEXP_TOTAL' },
]

function VarBadge({ value, type }: { value: number; type: string }) {
  if (value === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  // Positive variance = favorable for all (already sign-corrected in engine)
  const fav = value > 0
  return (
    <span className={`var-badge ${fav ? 'var-fav' : 'var-unfav'}`}>
      {fav ? '▲' : '▼'} {fmtCr(Math.abs(value))}
    </span>
  )
}

export default function MISPage() {
  const [fyId, setFyId]     = useState('')
  const [fyLabel, setFyLabel] = useState('')
  const [month, setMonth]   = useState(1)
  const [view, setView]     = useState<'monthly' | 'ytd'>('monthly')
  const [rows, setRows]     = useState<PLRow[]>([])
  const [budgetRev, setBudgetRev] = useState(0)
  const [actualRev, setActualRev] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFY() {
      const res  = await fetch('/api/fy/active')
      const data = await res.json()
      if (data?.id) {
        setFyId(data.id)
        setFyLabel(data.label)
        const now = new Date()
        const fm  = now.getMonth() >= 3 ? now.getMonth() - 2 : now.getMonth() + 10
        setMonth(Math.min(fm, 12))
      }
    }
    loadFY()
  }, [])

  useEffect(() => {
    if (!fyId || !month) return
    setLoading(true)
    fetch(`/api/mis/pl?fyId=${fyId}&month=${month}`)
      .then(r => r.json())
      .then(data => {
        setRows(data.rows ?? [])
        setBudgetRev(data.budgetRevenue ?? 0)
        setActualRev(data.actualRevenue ?? 0)
        setLoading(false)
      })
  }, [fyId, month])

  // Group rows by type, keep parent rows and child rows separate
  const rowMap = Object.fromEntries(rows.map(r => [r.code, r]))

  const b = (r: PLRow) => view === 'monthly' ? r.budget    : r.budgetYTD
  const a = (r: PLRow) => view === 'monthly' ? r.actual    : r.actualYTD
  const al= (r: PLRow) => view === 'monthly' ? r.allowed   : r.allowedYTD
  const v = (r: PLRow) => view === 'monthly' ? r.variance  : r.varianceYTD
  const pb= (r: PLRow) => r.pctBudget
  const pa= (r: PLRow) => r.pctActual

  const colStyle: React.CSSProperties = { minWidth: 110, fontVariantNumeric: 'tabular-nums' }

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">MIS P&amp;L Statement</h1>
          <p className="page-subtitle">FY {fyLabel} · Budget vs Actual vs Allowed vs Variance</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            {(['monthly', 'ytd'] as const).map(v => (
              <button key={v} id={`mis-view-${v}`}
                onClick={() => setView(v)}
                style={{
                  padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                  background: view === v ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color:      view === v ? 'var(--indigo-400)' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {v === 'monthly' ? 'Monthly' : 'YTD'}
              </button>
            ))}
          </div>
          {/* Month selector */}
          <select id="mis-month-select" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="select" style={{ width: 140 }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m} {i < 9 ? '2026' : '2027'}</option>)}
          </select>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <p className="kpi-label">Budget Revenue ({MONTHS[month - 1]})</p>
          <p className="kpi-value">₹{fmtCr(budgetRev)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Actual Revenue ({MONTHS[month - 1]})</p>
          <p className="kpi-value">₹{fmtCr(actualRev)}</p>
          <p className="kpi-sub">
            <span className={actualRev >= budgetRev ? 'kpi-positive' : 'kpi-negative'}>
              {budgetRev > 0 ? ((actualRev / budgetRev) * 100).toFixed(1) + '% of budget' : '—'}
            </span>
          </p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Variance (Revenue)</p>
          {(() => {
            const rev = rowMap['SALES_TOTAL']
            const var_ = rev ? v(rev) : 0
            return <>
              <p className="kpi-value" style={{ color: var_ >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                ₹{fmtCr(Math.abs(var_))}
              </p>
              <p className="kpi-sub"><span className={var_ >= 0 ? 'kpi-positive' : 'kpi-negative'}>
                {var_ >= 0 ? 'Favorable' : 'Unfavorable'}
              </span></p>
            </>
          })()}
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Net Profit (Allowed)</p>
          {(() => {
            const np = rowMap['NET_PROFIT']
            const val = np ? al(np) : 0
            return <>
              <p className="kpi-value" style={{ color: val >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                ₹{fmtCr(Math.abs(val))}
              </p>
            </>
          })()}
        </div>
      </div>

      {/* P&L Table */}
      {loading ? (
        <div className="card"><div className="skeleton" style={{ height: 500 }} /></div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="mis-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 250, position: 'sticky', left: 0, background: 'var(--surface-1)', zIndex: 2 }}>
                  Account Head
                </th>
                <th style={colStyle}>Budget</th>
                <th style={colStyle}>% Bgt</th>
                <th style={colStyle}>Actual</th>
                <th style={colStyle}>% Act</th>
                <th style={{ ...colStyle, color: 'var(--amber-400)' }}>Allowed</th>
                <th style={{ ...colStyle, color: 'var(--indigo-400)' }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_SECTIONS.map(section => {
                const sectionRows = rows.filter(r => r.type === section.type && r.parentId !== null)
                const totalRow    = rows.find(r => r.code === section.subtotal)
                if (!totalRow && !sectionRows.length) return null

                return [
                  <tr key={`hdr-${section.type}`} className="row-header">
                    <td colSpan={7}>{section.label}</td>
                  </tr>,

                  ...sectionRows.map(row => (
                    <tr key={row.accountHeadId}>
                      <td style={{ paddingLeft: 28, fontSize: '12.5px', color: 'var(--text-secondary)', position: 'sticky', left: 0, background: 'var(--surface-2)' }}>
                        {row.name}
                      </td>
                      <td>{fmtCr(b(row))}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtPct(pb(row))}</td>
                      <td className={a(row) > 0 ? '' : ''}>{fmtCr(a(row))}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtPct(pa(row))}</td>
                      <td style={{ color: 'var(--amber-400)' }}>{fmtCr(al(row))}</td>
                      <td><VarBadge value={v(row)} type={row.type} /></td>
                    </tr>
                  )),

                  totalRow ? (
                    <tr key={`total-${section.type}`} className="row-total">
                      <td style={{ paddingLeft: 14, position: 'sticky', left: 0, background: 'rgba(99,102,241,0.05)' }}>
                        {totalRow.name}
                      </td>
                      <td>{fmtCr(b(totalRow))}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtPct(pb(totalRow))}</td>
                      <td>{fmtCr(a(totalRow))}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtPct(pa(totalRow))}</td>
                      <td style={{ color: 'var(--amber-400)' }}>{fmtCr(al(totalRow))}</td>
                      <td><VarBadge value={v(totalRow)} type={totalRow.type} /></td>
                    </tr>
                  ) : null,

                  // Gross Profit after DIRECT_EXPENSE
                  section.type === 'DIRECT_EXPENSE' && rowMap['GROSS_PROFIT'] ? (
                    <tr key="gross-profit" className="row-total" style={{ background: 'rgba(99,102,241,0.08)' }}>
                      <td style={{ position: 'sticky', left: 0, background: 'rgba(99,102,241,0.08)', color: 'var(--indigo-400)' }}>
                        Gross Profit
                      </td>
                      <td style={{ color: 'var(--indigo-400)' }}>{fmtCr(b(rowMap['GROSS_PROFIT']))}</td>
                      <td />
                      <td style={{ color: 'var(--indigo-400)' }}>{fmtCr(a(rowMap['GROSS_PROFIT']))}</td>
                      <td />
                      <td style={{ color: 'var(--indigo-400)' }}>{fmtCr(al(rowMap['GROSS_PROFIT']))}</td>
                      <td><VarBadge value={v(rowMap['GROSS_PROFIT'])} type="REVENUE" /></td>
                    </tr>
                  ) : null,
                ]
              })}

              {/* Net Profit */}
              {rowMap['NET_PROFIT'] && (
                <tr className="row-total" style={{ borderTop: '2px solid rgba(99,102,241,0.3)' }}>
                  <td style={{ position: 'sticky', left: 0, background: 'rgba(99,102,241,0.1)', fontSize: 14, color: 'var(--indigo-400)' }}>
                    Net Profit
                  </td>
                  <td style={{ color: 'var(--indigo-400)', fontSize: 14 }}>{fmtCr(b(rowMap['NET_PROFIT']))}</td>
                  <td />
                  <td style={{ color: rowMap['NET_PROFIT'].actual >= 0 ? 'var(--green-400)' : 'var(--red-400)', fontSize: 14 }}>
                    {fmtCr(a(rowMap['NET_PROFIT']))}
                  </td>
                  <td />
                  <td style={{ color: 'var(--amber-400)', fontSize: 14 }}>{fmtCr(al(rowMap['NET_PROFIT']))}</td>
                  <td><VarBadge value={v(rowMap['NET_PROFIT'])} type="REVENUE" /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
