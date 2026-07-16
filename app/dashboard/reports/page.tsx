'use client'

import { useState, useEffect } from 'react'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

type PLRow = { code: string; name: string; type: string; parentId: string | null; budget: number; actual: number; allowed: number; variance: number }

function fmtN(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function ReportsPage() {
  const [fyId, setFyId]     = useState('')
  const [fyLabel, setFyLabel] = useState('')
  const [plData, setPlData]   = useState<PLRow[][]>([]) // one array per month
  const [loading, setLoading] = useState(true)
  const [report, setReport]   = useState<'consolidated' | 'monthly-trend'>('consolidated')

  useEffect(() => {
    async function load() {
      const fyRes  = await fetch('/api/fy/active')
      const fyData = await fyRes.json()
      if (!fyData?.id) { setLoading(false); return }
      setFyId(fyData.id)
      setFyLabel(fyData.label)

      // Load P&L for all 12 months
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          fetch(`/api/mis/pl?fyId=${fyData.id}&month=${i + 1}`).then(r => r.json())
        )
      )
      setPlData(results.map(r => r.rows ?? []))
      setLoading(false)
    }
    load()
  }, [])

  // Key rows for trend report
  const KEY_ROWS = ['SALES_TOTAL', 'COGS_TOTAL', 'GROSS_PROFIT', 'INDEXP_TOTAL', 'NET_PROFIT']

  function downloadCSV() {
    if (!plData.length) return

    const allRows = plData[0] ?? []
    const rows: string[][] = [
      ['Account Head', 'Type', ...MONTHS.map((m, i) => `${m} ${i < 9 ? '2026' : '2027'}`), 'Annual Total'],
    ]

    for (const row of allRows) {
      const monthVals = plData.map(monthRows => {
        const r = monthRows.find(r => r.code === row.code)
        return r ? r.actual : 0
      })
      const annual = monthVals.reduce((s, v) => s + v, 0)
      rows.push([row.name, row.type, ...monthVals.map(v => v.toString()), annual.toString()])
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `MIS_Actuals_${fyLabel}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">FY {fyLabel} · Full-year consolidated view and export</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button id="reports-export-csv" className="btn btn-secondary" onClick={downloadCSV}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="15" height="15">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Report tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['consolidated', 'Consolidated P&L'], ['monthly-trend', 'Monthly Trend']] as const).map(([k, label]) => (
          <button key={k} id={`report-tab-${k}`}
            onClick={() => setReport(k)}
            className={`btn ${report === k ? 'btn-primary' : 'btn-secondary'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card"><div className="skeleton" style={{ height: 500 }} /></div>
      ) : report === 'consolidated' ? (
        /* Consolidated: show all months side by side for key rows */
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="mis-table" style={{ minWidth: 1300 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 200, position: 'sticky', left: 0, background: 'var(--surface-1)', zIndex: 2 }}>Account Head</th>
                {MONTHS.map((m, i) => <th key={i} style={{ minWidth: 90 }}>{m}</th>)}
                <th style={{ color: 'var(--indigo-400)', minWidth: 110 }}>YTD Total</th>
              </tr>
            </thead>
            <tbody>
              {(plData[0] ?? []).map(row => {
                const monthActuals = plData.map(mr => {
                  const r = mr.find(r => r.code === row.code)
                  return r ? r.actual : 0
                })
                const ytd = monthActuals.reduce((s, v) => s + v, 0)
                const isTotal = !row.parentId || ['GROSS_PROFIT','NET_PROFIT'].includes(row.code)

                return (
                  <tr key={row.code} className={isTotal ? 'row-total' : ''}>
                    <td style={{
                      position: 'sticky', left: 0,
                      background: isTotal ? 'rgba(99,102,241,0.05)' : 'var(--surface-2)',
                      paddingLeft: row.parentId ? 28 : 14,
                      fontSize: row.parentId ? '12.5px' : '13px',
                    }}>
                      {row.name}
                    </td>
                    {monthActuals.map((v, i) => (
                      <td key={i} style={{ fontSize: 12.5 }}>{fmtN(v)}</td>
                    ))}
                    <td style={{ fontWeight: 600, color: 'var(--indigo-400)' }}>{fmtN(ytd)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Monthly trend for key rows */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {KEY_ROWS.map(code => {
            const label = (plData[0] ?? []).find(r => r.code === code)?.name ?? code
            const vals  = plData.map(mr => mr.find(r => r.code === code)?.actual ?? 0)
            const max   = Math.max(...vals, 1)
            return (
              <div key={code} className="card">
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>{label}</p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
                  {vals.map((v, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: '100%',
                        height: max > 0 ? `${Math.max((v / max) * 70, v > 0 ? 4 : 0)}px` : '2px',
                        background: v >= 0
                          ? 'linear-gradient(to top, var(--indigo-600), var(--indigo-400))'
                          : 'linear-gradient(to top, var(--red-500), var(--red-400))',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s',
                        minHeight: 2,
                      }} />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{MONTHS[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
