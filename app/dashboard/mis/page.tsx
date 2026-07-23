'use client'

import { useState, useEffect } from 'react'
import { PLBarChart } from '@/components/charts/PLCharts'
import { useFY } from '@/components/FYProvider'

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

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
  if (abs >= 1_00_000) return `${n < 0 ? '-' : ''}${(abs / 1_00_000).toFixed(2)}L`
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  if (!n || !isFinite(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

const TYPE_SECTIONS = [
  { type: 'REVENUE', label: 'Sales / Revenue', subtotal: 'SALES_TOTAL' },
  { type: 'COGS', label: 'Cost of Sales', subtotal: 'COGS_TOTAL' },
  { type: 'DIRECT_EXPENSE', label: 'Direct Expenses', subtotal: 'DIREXP_TOTAL' },
  { type: 'INDIRECT_INCOME', label: 'Indirect Income', subtotal: 'INDINC_TOTAL' },
  { type: 'INDIRECT_EXPENSE', label: 'Indirect Expenses', subtotal: 'INDEXP_TOTAL' },
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
  const { fyId, fyLabel } = useFY()
  const [month, setMonth] = useState(0) // 0 implies uninitialized
  const [segment, setSegment] = useState<'ALL' | 'MFG_LAB' | 'DND'>('ALL')
  const [view, setView] = useState<'monthly' | 'ytd'>('monthly')
  const [showChart, setShowChart] = useState(false)
  const [rows, setRows] = useState<PLRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!fyId) return
      setLoading(true)

      let selectedMonth = month
      // Auto-select OPEN month if this is the first load for a new FY
      if (!month) {
        const pRes = await fetch(`/api/periods?fyId=${fyId}`)
        const pData = await pRes.json()
        const open = Array.isArray(pData) ? pData.find(p => p.status === 'OPEN') : null
        selectedMonth = open ? open.month : 1
        setMonth(selectedMonth)
      }

      const mRes = await fetch(`/api/mis/pl?fyId=${fyId}&month=${selectedMonth}&segment=${segment}`)
      const mData = await mRes.json()
      setRows(mData.rows || [])
      setLoading(false)
    }
    load()
  }, [fyId, month, segment])

  // Group rows by type, keep parent rows and child rows separate
  const rowMap = Object.fromEntries(rows.map(r => [r.code, r]))

  const b = (r: PLRow) => view === 'monthly' ? r.budget : r.budgetYTD
  const a = (r: PLRow) => view === 'monthly' ? r.actual : r.actualYTD
  const al = (r: PLRow) => view === 'monthly' ? r.allowed : r.allowedYTD
  const v = (r: PLRow) => view === 'monthly' ? r.variance : r.varianceYTD
  const pb = (r: PLRow) => r.pctBudget
  const pa = (r: PLRow) => r.pctActual
  const mfg = rowMap['SALES_MFG']
  const dnd = rowMap['SALES_DND']
  const bRev = (mfg ? b(mfg) : 0) + (dnd ? b(dnd) : 0)
  const aRev = (mfg ? a(mfg) : 0) + (dnd ? a(dnd) : 0)

  const getRow = (code: string) => rows.find(r => r.code === code)
                
  const sumObjs = (...objs: any[]) => objs.reduce((acc, r) => {
    if (!r) return acc
    return {
      budget: acc.budget + (r.budget||0),
      actual: acc.actual + (r.actual||0),
      allowed: acc.allowed + (r.allowed||0),
      variance: acc.variance + (r.variance||0),
      budgetYTD: acc.budgetYTD + (r.budgetYTD||0),
      actualYTD: acc.actualYTD + (r.actualYTD||0),
      allowedYTD: acc.allowedYTD + (r.allowedYTD||0),
      varianceYTD: acc.varianceYTD + (r.varianceYTD||0),
    }
  }, { budget:0, actual:0, allowed:0, variance:0, budgetYTD:0, actualYTD:0, allowedYTD:0, varianceYTD:0 })

  const subObj = (a: any, b: any) => ({
    budget: (a?.budget||0) - (b?.budget||0),
    actual: (a?.actual||0) - (b?.actual||0),
    allowed: (a?.allowed||0) - (b?.allowed||0),
    variance: (a?.variance||0) - (b?.variance||0),
    budgetYTD: (a?.budgetYTD||0) - (b?.budgetYTD||0),
    actualYTD: (a?.actualYTD||0) - (b?.actualYTD||0),
    allowedYTD: (a?.allowedYTD||0) - (b?.allowedYTD||0),
    varianceYTD: (a?.varianceYTD||0) - (b?.varianceYTD||0),
  })

  const salesObj = sumObjs(getRow('SALES_MFG'), getRow('SALES_DND'))
  const purchObj = sumObjs(getRow('PURCH_RM'), getRow('PURCH_SC'), getRow('PURCH_CON'))
  const consumpObj = subObj(sumObjs(getRow('OPEN_STOCK'), purchObj), getRow('CLOSE_STOCK'))
  
  const dirExpChildren = rows.filter(r => r.parentId === getRow('DIREXP_TOTAL')?.accountHeadId)
  const dirExpObj = sumObjs(...dirExpChildren)
  const cogsObj = sumObjs(consumpObj, dirExpObj)
  const gpObj = subObj(salesObj, cogsObj)
  gpObj.variance = gpObj.actual - gpObj.allowed
  gpObj.varianceYTD = gpObj.actualYTD - gpObj.allowedYTD

  const indIncChildren = rows.filter(r => r.parentId === getRow('INDINC_TOTAL')?.accountHeadId)
  const indIncObj = sumObjs(...indIncChildren)
  
  const indExpChildren = rows.filter(r => r.parentId === getRow('INDEXP_TOTAL')?.accountHeadId)
  const indExpObj = sumObjs(...indExpChildren)

  const npObj = subObj(sumObjs(gpObj, indIncObj), indExpObj)
  npObj.variance = npObj.actual - npObj.allowed
  npObj.varianceYTD = npObj.actualYTD - npObj.allowedYTD

  const npActual = view === 'monthly' ? npObj.actual : npObj.actualYTD
  const npAllowed = view === 'monthly' ? npObj.allowed : npObj.allowedYTD
  const npBudget = view === 'monthly' ? npObj.budget : npObj.budgetYTD
  const npVarAllowed = view === 'monthly' ? npObj.variance : npObj.varianceYTD
  const npVarBudget = npActual - npBudget

  const colStyle: React.CSSProperties = { minWidth: 110, fontVariantNumeric: 'tabular-nums' }

  const formatMoney = (n: number) => n === 0 ? '—' : (n < 0 ? '-₹' : '₹') + fmtCr(Math.abs(n)).replace(/^-/, '')

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">MIS P&amp;L Statement</h1>
          <p className="page-subtitle">FY {fyLabel} · Budget vs Actual vs Allowed vs Variance</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Export PDF */}
          <button id="mis-export-pdf" className="btn btn-secondary" onClick={() => window.print()} style={{ fontSize: 12.5, padding: '7px 12px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print PDF
          </button>
          {/* Chart toggle */}
          <button id="mis-chart-toggle"
            onClick={() => setShowChart(c => !c)}
            className={`btn ${showChart ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12.5, padding: '7px 12px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="14" height="14">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
            </svg>
            Chart
          </button>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            {(['monthly', 'ytd'] as const).map(v => (
              <button key={v} id={`mis-view-${v}`}
                onClick={() => setView(v)}
                style={{
                  padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                  background: view === v ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: view === v ? 'var(--indigo-400)' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {v === 'monthly' ? 'Monthly' : 'YTD'}
              </button>
            ))}
          </div>
          {/* Segment selector */}
          <select id="mis-segment-select" value={segment} onChange={e => setSegment(e.target.value as 'ALL' | 'MFG_LAB' | 'DND')} className="select" style={{ width: 140 }}>
            <option value="ALL">All Segments</option>
            <option value="MFG_LAB">MFG & Lab</option>
            <option value="DND">D & D</option>
          </select>
          {/* Month selector */}
          <select id="mis-month-select" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="select" style={{ width: 140 }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m} {i < 9 ? '2026' : '2027'}</option>)}
          </select>
        </div>
      </div>

      {/* Chart panel */}
      {showChart && !loading && (() => {
        const SKIP = ['GROSS_PROFIT', 'NET_PROFIT', 'SALES_TOTAL', 'COGS_TOTAL', 'DIREXP_TOTAL', 'INDINC_TOTAL', 'INDEXP_TOTAL']
        const chartRows = rows.filter(r => !SKIP.includes(r.code) && r.parentId !== null).slice(0, 12)
        const chartData = chartRows.map(r => ({
          month: r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name,
          budget: view === 'monthly' ? r.budget : r.budgetYTD,
          actual: view === 'monthly' ? r.actual : r.actualYTD,
          allowed: view === 'monthly' ? r.allowed : r.allowedYTD,
        }))
        return (
          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>
              Budget vs Actual vs Allowed — {view === 'monthly' ? MONTHS[month - 1] : `YTD Apr–${MONTHS[month - 1]}`}
            </p>
            <PLBarChart data={chartData} height={300} />
          </div>
        )
      })()}

      {/* Revenue KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <p className="kpi-label">Budget Revenue ({view === 'monthly' ? MONTHS[month - 1] : 'YTD'})</p>
          <p className="kpi-value">₹{fmtCr(bRev)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Actual Revenue ({view === 'monthly' ? MONTHS[month - 1] : 'YTD'})</p>
          <p className="kpi-value">₹{fmtCr(aRev)}</p>
          <p className="kpi-sub">
            <span className={aRev >= bRev ? 'kpi-positive' : 'kpi-negative'}>
              {bRev > 0 ? ((aRev / bRev) * 100).toFixed(1) + '% of budget' : '—'}
            </span>
          </p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Net Profit ({view === 'monthly' ? MONTHS[month - 1] : 'YTD'})</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>BUDGET</p>
              <p className="kpi-value" style={{ color: npBudget >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                {formatMoney(npBudget)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>ACTUAL</p>
              <p className="kpi-value" style={{ color: npActual >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                {formatMoney(npActual)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>ALLOWED</p>
              <p className="kpi-value" style={{ color: npAllowed >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                {formatMoney(npAllowed)}
              </p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Variance (Net Profit)</p>
          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>VS BUDGET</p>
              <p className="kpi-value" style={{ color: npVarBudget >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                {formatMoney(npVarBudget)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>VS ALLOWED</p>
              <p className="kpi-value" style={{ color: npVarAllowed >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                {formatMoney(npVarAllowed)}
              </p>
            </div>
          </div>
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
              {(() => {
                const renderRow = (code: string) => {
                  const row = getRow(code)
                  if (!row) return null
                  return (
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
                  )
                }

                const renderSubtotalRow = (label: string, computed: any, level: 'primary' | 'secondary' | 'tertiary' = 'secondary') => {
                  let bg = 'var(--surface-3)'
                  let color = 'var(--text-primary)'
                  let highlight = 'var(--indigo-400)'
                  let subtext = 'var(--text-secondary)'
                  
                  if (level === 'primary') {
                    bg = 'var(--indigo-600)'
                    color = '#fff'
                    highlight = '#fff'
                    subtext = 'rgba(255,255,255,0.7)'
                  } else if (level === 'tertiary') {
                    bg = 'var(--surface-2)'
                  }

                  const revB = b(salesObj)
                  const revA = a(salesObj)
                  const pctB = revB ? (b(computed) / revB * 100) : 0
                  const pctA = revA ? (a(computed) / revA * 100) : 0

                  return (
                    <tr key={`subtotal-${label}`} style={{ background: bg, fontWeight: 600 }}>
                      <td style={{ position: 'sticky', left: 0, background: bg, zIndex: 1, paddingLeft: 14, color: color }}>{label}</td>
                      <td style={{ color: highlight }}>{fmtCr(b(computed))}</td>
                      <td style={{ color: subtext, fontSize: 12 }}>{pctB !== 0 ? pctB.toFixed(1) + '%' : '—'}</td>
                      <td style={{ color: level==='primary'?'#fff':'' }}>{fmtCr(a(computed))}</td>
                      <td style={{ color: subtext, fontSize: 12 }}>{pctA !== 0 ? pctA.toFixed(1) + '%' : '—'}</td>
                      <td style={{ color: level==='primary'?'#ffd54f':'var(--amber-400)' }}>{fmtCr(al(computed))}</td>
                      <td><VarBadge value={v(computed)} type="REVENUE" /></td>
                    </tr>
                  )
                }

                return (
                  <>
                    {renderSubtotalRow('Sales Accounts', salesObj, 'secondary')}
                    {renderRow('SALES_MFG')}
                    {renderRow('SALES_DND')}

                    {renderSubtotalRow('Cost of Sales', cogsObj, 'secondary')}
                    {renderRow('OPEN_STOCK')}
                    {renderSubtotalRow('Add: Purchase Accounts', purchObj, 'tertiary')}
                    {renderRow('PURCH_RM')}
                    {renderRow('PURCH_SC')}
                    {renderRow('PURCH_CON')}
                    {renderRow('CLOSE_STOCK')}
                    {renderSubtotalRow('Consumption', consumpObj, 'tertiary')}
                    
                    {renderSubtotalRow('Direct Expenses', dirExpObj, 'tertiary')}
                    {dirExpChildren.map(h => renderRow(h.code))}
                    
                    {renderSubtotalRow('Gross Profit', gpObj, 'primary')}

                    {renderSubtotalRow('Indirect Incomes', indIncObj, 'secondary')}
                    {indIncChildren.map(h => renderRow(h.code))}

                    {renderSubtotalRow('Indirect Expenses', indExpObj, 'secondary')}
                    {indExpChildren.map(h => renderRow(h.code))}

                    {renderSubtotalRow('Net Profit', npObj, 'primary')}
                  </>
                )
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
