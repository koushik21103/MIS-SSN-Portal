'use client'

import { useState, useEffect } from 'react'
import { useFY } from '@/components/FYProvider'

type AssetRow = {
  assetId: string; assetName: string; category: string; rateEnum: string; ratePct: number; isActive: boolean
  openingWdv: number; additionsGte180: number; additionsLt180: number
  disposalsLt180: number; disposalsGte180: number
  annualDepr: number; monthlyDepr: number; closingWdv: number
}
type Totals = { totalOpeningWdv: number; totalAnnualDepr: number; totalMonthlyDepr: number; totalClosingWdv: number }

function fmt(n: number, dec = 0) {
  if (n === 0) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const CATEGORY_COLORS: Record<string, string> = {
  Machinery: 'var(--indigo-400)', Computer: 'var(--green-400)',
  Furniture: 'var(--amber-400)',  Vehicle: 'var(--violet-500)',
}

export default function DepreciationPage() {
  const { fyId, fyLabel } = useFY()
  const [schedule, setSchedule] = useState<AssetRow[]>([])
  const [totals, setTotals]   = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('All')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    async function load() {
      if (!fyId) return
      setLoading(true)

      const res = await fetch(`/api/depreciation?fyId=${fyId}`)
      const data = await res.json()
      
      setSchedule(data.schedule || [])
      setTotals(data.totals || { totalOpeningWdv: 0, totalAnnualDepr: 0, totalMonthlyDepr: 0, totalClosingWdv: 0 })
      setLoading(false)
    }
    load()
  }, [fyId])

  const categories = ['All', ...Array.from(new Set(schedule.map(a => a.category)))]

  const filtered = schedule.filter(a => {
    const catOk  = filterCat === 'All' || a.category === filterCat
    const searchOk = !search || a.assetName.toLowerCase().includes(search.toLowerCase())
    return catOk && searchOk
  })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Asset Register &amp; Depreciation</h1>
          <p className="page-subtitle">FY {fyLabel} · WDV method — 15% (Plant/Machinery) / 40% (Computers)</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input id="depr-search" type="search" placeholder="Search assets…" className="input" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
          <select id="depr-category-filter" value={filterCat} onChange={e => setFilterCat(e.target.value)} className="select" style={{ width: 140 }}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Totals KPIs */}
      {totals && (
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div className="kpi-card">
            <p className="kpi-label">Opening WDV (01 Apr)</p>
            <p className="kpi-value">₹{fmt(totals.totalOpeningWdv)}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Annual Depreciation</p>
            <p className="kpi-value" style={{ color: 'var(--red-400)' }}>₹{fmt(totals.totalAnnualDepr)}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Monthly Depreciation</p>
            <p className="kpi-value">₹{fmt(totals.totalMonthlyDepr, 0)}</p>
            <p className="kpi-sub">Charged each month</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Closing WDV (31 Mar)</p>
            <p className="kpi-value">₹{fmt(totals.totalClosingWdv)}</p>
          </div>
        </div>
      )}

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button key={c} id={`depr-cat-${c.toLowerCase()}`}
            onClick={() => setFilterCat(c)}
            className={`btn ${filterCat === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12.5, padding: '6px 12px' }}>
            {c} {c !== 'All' ? `(${schedule.filter(a => a.category === c).length})` : `(${schedule.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="mis-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 280 }}>#  Asset</th>
                <th>Category</th>
                <th>Rate</th>
                <th>Opening WDV</th>
                <th>Additions ≥180d</th>
                <th>Additions &lt;180d</th>
                <th>Disposals</th>
                <th style={{ color: 'var(--red-400)' }}>Annual Depr.</th>
                <th style={{ color: 'var(--amber-400)' }}>Monthly Depr.</th>
                <th style={{ color: 'var(--green-400)' }}>Closing WDV</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset, idx) => (
                <tr key={asset.assetId}>
                  <td style={{ fontWeight: 500, fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 8, fontSize: 11 }}>{idx + 1}</span>
                    {asset.assetName}
                    {!asset.isActive && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--red-400)', border: '1px solid', padding: '1px 5px', borderRadius: 4 }}>DISPOSED</span>}
                  </td>
                  <td>
                    <span style={{ fontSize: 11.5, color: CATEGORY_COLORS[asset.category] ?? 'var(--text-secondary)' }}>
                      {asset.category}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{asset.ratePct}%</td>
                  <td>{fmt(asset.openingWdv, 2)}</td>
                  <td style={{ color: 'var(--green-400)' }}>{asset.additionsGte180 > 0 ? fmt(asset.additionsGte180, 2) : '—'}</td>
                  <td style={{ color: 'var(--green-400)' }}>{asset.additionsLt180 > 0 ? fmt(asset.additionsLt180, 2) : '—'}</td>
                  <td style={{ color: 'var(--red-400)' }}>
                    {(asset.disposalsLt180 + asset.disposalsGte180) > 0
                      ? fmt(asset.disposalsLt180 + asset.disposalsGte180, 2)
                      : '—'}
                  </td>
                  <td style={{ color: 'var(--red-400)', fontWeight: 500 }}>{fmt(asset.annualDepr, 2)}</td>
                  <td style={{ color: 'var(--amber-400)', fontWeight: 500 }}>{fmt(asset.monthlyDepr, 2)}</td>
                  <td style={{ color: 'var(--green-400)', fontWeight: 600 }}>{fmt(asset.closingWdv, 2)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="row-total">
                  <td colSpan={3} style={{ textAlign: 'left' }}>Total ({filtered.length} assets)</td>
                  <td>{fmt(filtered.reduce((s, a) => s + a.openingWdv, 0), 0)}</td>
                  <td>{fmt(filtered.reduce((s, a) => s + a.additionsGte180, 0), 0)}</td>
                  <td>{fmt(filtered.reduce((s, a) => s + a.additionsLt180, 0), 0)}</td>
                  <td>{fmt(filtered.reduce((s, a) => s + a.disposalsLt180 + a.disposalsGte180, 0), 0)}</td>
                  <td style={{ color: 'var(--red-400)' }}>{fmt(filtered.reduce((s, a) => s + a.annualDepr, 0), 0)}</td>
                  <td style={{ color: 'var(--amber-400)' }}>{fmt(filtered.reduce((s, a) => s + a.monthlyDepr, 0), 2)}</td>
                  <td style={{ color: 'var(--green-400)' }}>{fmt(filtered.reduce((s, a) => s + a.closingWdv, 0), 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
