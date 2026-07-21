'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFY } from '@/components/FYProvider'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

type Asset = {
  id: string; name: string; category: string; rateEnum: string; isActive: boolean; purchaseDate: string
  yearBalances: { openingWdv: string }[]
  movements: { id: string; type: string; amount: string; date: string; notes: string | null; holdingDays: number; isGte180Days: boolean }[]
}

const RATE_OPTS = [
  { value: 'FIFTEEN', label: '15% — Machinery / Furniture / Vehicle' },
  { value: 'FORTY',   label: '40% — Computers / Electronics' },
]
const CATEGORIES = ['Machinery', 'Computer', 'Furniture', 'Vehicle', 'Equipment', 'Other']

export default function AssetsPage() {
  const { fyId, fyLabel } = useFY()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [showAddModal, setShowAddModal] = useState(false)
  const [movModal, setMovModal] = useState<Asset | null>(null)
  const [addForm, setAddForm] = useState({ name: '', category: 'Machinery', rateEnum: 'FIFTEEN', purchaseDate: '', openingWdv: '' })
  const [movForm, setMovForm] = useState({ type: 'ADDITION', amount: '', date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const loadAssets = useCallback(async () => {
    if (!fyId) return
    setLoading(true)
    const res = await fetch(`/api/assets?fyId=${fyId}`)
    const data = await res.json()
    setAssets(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [fyId])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const categories = ['All', ...Array.from(new Set(assets.map(a => a.category)))]
  const filtered   = assets.filter(a => {
    const catOk = filterCat === 'All' || a.category === filterCat
    const srch  = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return catOk && srch
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, openingWdv: parseFloat(addForm.openingWdv), financialYearId: fyId }),
    })
    if (res.ok) { setShowAddModal(false); loadAssets() }
    else { const d = await res.json(); setError(d.error ?? 'Failed') }
    setSaving(false)
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault()
    if (!movModal) return
    setSaving(true); setError('')
    const res = await fetch('/api/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'movement', assetId: movModal.id, financialYearId: fyId, ...movForm, amount: parseFloat(movForm.amount) }),
    })
    if (res.ok) { setMovModal(null); loadAssets() }
    else { const d = await res.json(); setError(d.error ?? 'Failed') }
    setSaving(false)
  }

  const totalActive    = assets.filter(a => a.isActive).length
  const totalInactive  = assets.filter(a => !a.isActive).length
  const totalOpeningWdv = assets.reduce((s, a) => s + Number(a.yearBalances[0]?.openingWdv ?? 0), 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Asset Register</h1>
          <p className="page-subtitle">FY {fyLabel} · Manage fixed assets, additions and disposals</p>
        </div>
        <button id="assets-add-btn" className="btn btn-primary" onClick={() => { setAddForm({ name: '', category: 'Machinery', rateEnum: 'FIFTEEN', purchaseDate: '', openingWdv: '' }); setError(''); setShowAddModal(true) }}>
          + Add Asset
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <p className="kpi-label">Total Assets</p>
          <p className="kpi-value">{assets.length}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Active</p>
          <p className="kpi-value" style={{ color: 'var(--green-400)' }}>{totalActive}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Disposed</p>
          <p className="kpi-value" style={{ color: 'var(--red-400)' }}>{totalInactive}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Total Opening WDV</p>
          <p className="kpi-value">₹{totalOpeningWdv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input id="assets-search" type="search" placeholder="Search assets…" className="input" value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        {categories.map(c => (
          <button key={c} id={`assets-cat-${c.toLowerCase()}`}
            onClick={() => setFilterCat(c)}
            className={`btn ${filterCat === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12.5, padding: '6px 12px' }}>
            {c} {c !== 'All' ? `(${assets.filter(a => a.category === c).length})` : `(${assets.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>
      ) : (
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="mis-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 260 }}>#  Asset Name</th>
                <th>Category</th>
                <th>Rate</th>
                <th>Purchase Date</th>
                <th>Opening WDV (₹)</th>
                <th>Movements</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset, idx) => (
                <tr key={asset.id}>
                  <td style={{ fontWeight: 500 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 8 }}>{idx + 1}</span>
                    {asset.name}
                  </td>
                  <td style={{ color: 'var(--indigo-400)', fontSize: 12.5 }}>{asset.category}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {asset.rateEnum === 'FIFTEEN' ? '15%' : '40%'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(asset.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {Number(asset.yearBalances[0]?.openingWdv ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    {asset.movements.length > 0 ? (
                      <span style={{ fontSize: 11.5, color: 'var(--amber-400)' }}>
                        {asset.movements.length} movement{asset.movements.length > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`role-badge ${asset.isActive ? 'role-finance' : 'role-viewer'}`}>
                      {asset.isActive ? 'Active' : 'Disposed'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {asset.isActive && (
                      <button id={`asset-mov-${idx}`}
                        className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 8px' }}
                        onClick={() => { setMovModal(asset); setMovForm({ type: 'ADDITION', amount: '', date: '', notes: '' }); setError('') }}>
                        + Move
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, width: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Add New Asset</h2>
            {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}
            <form id="asset-add-form" onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Asset Name</label>
                <input id="asset-name" className="input" required value={addForm.name}
                  onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. CNC Machine XL-500" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select id="asset-category" className="select" value={addForm.category}
                    onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Depreciation Rate</label>
                  <select id="asset-rate" className="select" value={addForm.rateEnum}
                    onChange={e => setAddForm(p => ({ ...p, rateEnum: e.target.value }))}>
                    {RATE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input id="asset-purchase-date" className="input" type="date" required value={addForm.purchaseDate}
                    onChange={e => setAddForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening WDV (₹)</label>
                  <input id="asset-opening-wdv" className="input" type="number" required step="0.01" min="0"
                    value={addForm.openingWdv}
                    onChange={e => setAddForm(p => ({ ...p, openingWdv: e.target.value }))}
                    placeholder="0.00" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" id="asset-add-submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Adding…' : 'Add Asset'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {movModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, width: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Record Movement</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>{movModal.name}</p>
            {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}
            <form id="asset-mov-form" onSubmit={handleMovement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select id="mov-type" className="select" value={movForm.type}
                  onChange={e => setMovForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="ADDITION">Addition (new purchase / upgrade)</option>
                  <option value="DISPOSAL">Disposal (sale / scrap)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input id="mov-amount" className="input" type="number" required step="0.01" min="0"
                    value={movForm.amount} onChange={e => setMovForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input id="mov-date" className="input" type="date" required
                    value={movForm.date} onChange={e => setMovForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input id="mov-notes" className="input" value={movForm.notes}
                  onChange={e => setMovForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Sold to XYZ vendor" />
              </div>
              {movForm.type === 'DISPOSAL' && (
                <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: 10, fontSize: 12.5, color: 'var(--red-400)' }}>
                  ⚠ Disposal will mark the asset as <strong>inactive</strong>. This cannot be undone from the UI.
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" id="mov-submit"
                  className={`btn ${movForm.type === 'DISPOSAL' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Saving…' : movForm.type === 'DISPOSAL' ? 'Record Disposal' : 'Record Addition'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setMovModal(null)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
