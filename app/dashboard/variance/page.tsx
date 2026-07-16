'use client'

import { useState, useEffect } from 'react'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

type PLRow = {
  accountHeadId: string; code: string; name: string; type: string
  allowedType: string; sortOrder: number; parentId: string | null
  budget: number; actual: number; allowed: number; variance: number
  budgetYTD: number; actualYTD: number; allowedYTD: number; varianceYTD: number
}

function fmtN(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function VariancePage() {
  const [fyId, setFyId]     = useState('')
  const [fyLabel, setFyLabel] = useState('')
  const [month, setMonth]   = useState(1)
  const [view, setView]     = useState<'monthly' | 'ytd'>('monthly')
  const [rows, setRows]     = useState<PLRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unfav' | 'fav'>('all')

  useEffect(() => {
    async function init() {
      const res  = await fetch('/api/fy/active')
      const data = await res.json()
      if (data?.id) {
        setFyId(data.id)
        setFyLabel(data.label)
        const now = new Date()
        setMonth(now.getMonth() >= 3 ? now.getMonth() - 2 : now.getMonth() + 10)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!fyId || !month) return
    setLoading(true)
    fetch(`/api/mis/pl?fyId=${fyId}&month=${month}`)
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [fyId, month])

  const getVar = (r: PLRow) => view === 'monthly' ? r.variance : r.varianceYTD
  const getAllowed = (r: PLRow) => view === 'monthly' ? r.allowed : r.allowedYTD
  const getActual = (r: PLRow) => view === 'monthly' ? r.actual : r.actualYTD
  const getBudget = (r: PLRow) => view === 'monthly' ? r.budget : r.budgetYTD

  // Filter out totals and computed rows; show only leaf rows with data
  const SKIP_CODES = ['GROSS_PROFIT', 'NET_PROFIT', 'SALES_TOTAL', 'COGS_TOTAL', 'DIREXP_TOTAL', 'INDINC_TOTAL', 'INDEXP_TOTAL', 'PURCH_TOTAL']
  const leafRows = rows.filter(r => !SKIP_CODES.includes(r.code) && r.parentId !== null)

  const filtered = leafRows.filter(r => {
    const v = getVar(r)
    if (filter === 'fav')   return v > 0
    if (filter === 'unfav') return v < 0
    return true
  })

  const totalFav   = leafRows.filter(r => getVar(r) > 0).reduce((s, r) => s + getVar(r), 0)
  const totalUnfav = leafRows.filter(r => getVar(r) < 0).reduce((s, r) => s + getVar(r), 0)
  const netVariance = totalFav + totalUnfav

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Variance Analysis</h1>
          <p className="page-subtitle">FY {fyLabel} · Allowed vs Actual — favorable and unfavorable items</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            {(['monthly', 'ytd'] as const).map(v => (
              <button key={v} id={`var-view-${v}`} onClick={() => setView(v)}
                style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 500, background: view === v ? 'rgba(99,102,241,0.15)' : 'transparent', color: view === v ? 'var(--indigo-400)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                {v === 'monthly' ? 'Monthly' : 'YTD'}
              </button>
            ))}
          </div>
          <select id="var-month-select" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="select" style={{ width: 140 }}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m} {i<9?'2026':'2027'}</option>)}
          </select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <p className="kpi-label">Net Variance</p>
          <p className="kpi-value" style={{ color: netVariance >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
            ₹{fmtN(Math.abs(netVariance))}
          </p>
          <p className="kpi-sub"><span className={netVariance >= 0 ? 'kpi-positive' : 'kpi-negative'}>{netVariance >= 0 ? 'Overall Favorable' : 'Overall Unfavorable'}</span></p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Favorable Items</p>
          <p className="kpi-value" style={{ color: 'var(--green-400)' }}>₹{fmtN(totalFav)}</p>
          <p className="kpi-sub">{leafRows.filter(r => getVar(r) > 0).length} line items</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Unfavorable Items</p>
          <p className="kpi-value" style={{ color: 'var(--red-400)' }}>₹{fmtN(Math.abs(totalUnfav))}</p>
          <p className="kpi-sub">{leafRows.filter(r => getVar(r) < 0).length} line items</p>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['all', 'All'], ['fav', 'Favorable Only'], ['unfav', 'Unfavorable Only']] as const).map(([k, label]) => (
          <button key={k} id={`var-filter-${k}`} onClick={() => setFilter(k)}
            className={`btn ${filter === k ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12.5, padding: '6px 12px' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>
      ) : (
        <div className="table-wrapper">
          <table className="mis-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 260 }}>Account Head</th>
                <th>Type</th>
                <th>Budget</th>
                <th>Actual</th>
                <th style={{ color: 'var(--amber-400)' }}>Allowed</th>
                <th style={{ color: 'var(--indigo-400)' }}>Variance</th>
                <th>% Gap</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No items found</td></tr>
              ) : filtered
                .sort((a, b) => getVar(a) - getVar(b)) // worst first
                .map(row => {
                  const varVal = getVar(row)
                  const allowed = getAllowed(row)
                  const pctGap = allowed !== 0 ? ((varVal / Math.abs(allowed)) * 100) : 0
                  const isFav  = varVal > 0

                  return (
                    <tr key={row.accountHeadId}>
                      <td style={{ fontWeight: 500 }}>{row.name}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {row.type.replace('_', ' ')}
                      </td>
                      <td>{fmtN(getBudget(row))}</td>
                      <td>{fmtN(getActual(row))}</td>
                      <td style={{ color: 'var(--amber-400)' }}>{fmtN(allowed)}</td>
                      <td>
                        <span className={`var-badge ${isFav ? 'var-fav' : 'var-unfav'}`}>
                          {isFav ? '▲' : '▼'} {fmtN(Math.abs(varVal))}
                        </span>
                      </td>
                      <td style={{ color: isFav ? 'var(--green-400)' : 'var(--red-400)', fontSize: 12 }}>
                        {isFinite(pctGap) ? `${pctGap.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
