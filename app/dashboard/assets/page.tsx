'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFY } from '@/components/FYProvider'
import { useSession } from 'next-auth/react'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

type Asset = {
  id: string; name: string; category: string; rateEnum: string; isActive: boolean; purchaseDate: string
  yearBalances: { openingWdv: string }[]
  movements: { id: string; type: string; amount: string; date: string; notes: string | null }[]
}

type EditRequest = {
  id: string; action: string; payload: string; status: string; createdAt: string;
  assetId: string | null;
  requestedBy: { name: string; email: string; role: string }
}

const RATE_OPTS = [
  { value: 'FIFTEEN', label: '15% — Machinery / Furniture / Vehicle' },
  { value: 'FORTY',   label: '40% — Computers / Electronics' },
]
const CATEGORIES = ['Machinery', 'Computer', 'Furniture', 'Vehicle', 'Equipment', 'Other']

export default function AssetsPage() {
  const { fyId, fyLabel } = useFY()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'CFO'

  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editModal, setEditModal] = useState<Asset | null>(null)
  const [movModal, setMovModal] = useState<Asset | null>(null)
  const [showRequestsPanel, setShowRequestsPanel] = useState(false)

  // Forms
  const [addForm, setAddForm] = useState({ name: '', category: 'Machinery', rateEnum: 'FIFTEEN', purchaseDate: '', openingWdv: '' })
  const [editForm, setEditForm] = useState({ name: '', category: '', rateEnum: '', purchaseDate: '', openingWdv: '', isActive: true })
  const [movForm, setMovForm] = useState({ type: 'ADDITION', amount: '', date: '', notes: '' })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Edit requests
  const [editRequests, setEditRequests] = useState<EditRequest[]>([])
  const [reqLoading, setReqLoading] = useState(false)

  const loadAssets = useCallback(async () => {
    if (!fyId) return
    setLoading(true)
    const res = await fetch(`/api/assets?fyId=${fyId}`)
    const data = await res.json()
    setAssets(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [fyId])

  const loadRequests = useCallback(async () => {
    if (!fyId) return
    setReqLoading(true)
    const res = await fetch(`/api/assets/edit-request?fyId=${fyId}`)
    const data = await res.json()
    setEditRequests(Array.isArray(data) ? data : [])
    setReqLoading(false)
  }, [fyId])

  useEffect(() => { loadAssets() }, [loadAssets])
  useEffect(() => { if (showRequestsPanel) loadRequests() }, [showRequestsPanel, loadRequests])

  const categories = ['All', ...Array.from(new Set(assets.map(a => a.category)))]
  const filtered = assets.filter(a => {
    const catOk = filterCat === 'All' || a.category === filterCat
    const srch  = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return catOk && srch
  })

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  // Submit add request (always needs approval unless admin directly adds)
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = { ...addForm, openingWdv: parseFloat(addForm.openingWdv) }

    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, financialYearId: fyId }),
    })
    if (res.ok) {
      setShowAddModal(false)
      loadAssets()
      showSuccess('Asset added successfully to register.')
    } else {
      // Fallback: submit change request for approval
      const reqRes = await fetch('/api/assets/edit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYearId: fyId, action: 'CREATE', payload }),
      })
      if (reqRes.ok) {
        setShowAddModal(false)
        showSuccess('Asset creation request submitted for approval.')
      } else {
        const d = await reqRes.json()
        setError(d.error ?? 'Failed to add asset')
      }
    }
    setSaving(false)
  }

  // Open edit modal – pre-fill form
  function openEditModal(asset: Asset) {
    setEditForm({
      name: asset.name,
      category: asset.category,
      rateEnum: asset.rateEnum,
      purchaseDate: asset.purchaseDate.slice(0, 10),
      openingWdv: String(Number(asset.yearBalances[0]?.openingWdv ?? 0)),
      isActive: asset.isActive,
    })
    setEditModal(asset)
    setError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal) return
    setSaving(true); setError('')

    const payload = {
      id: editModal.id,
      financialYearId: fyId,
      name: editForm.name,
      category: editForm.category,
      rateEnum: editForm.rateEnum,
      purchaseDate: editForm.purchaseDate,
      openingWdv: parseFloat(editForm.openingWdv),
      isActive: editForm.isActive,
    }

    if (isAdmin) {
      const res = await fetch('/api/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setEditModal(null)
        loadAssets()
        showSuccess('Asset updated successfully.')
      } else {
        const d = await res.json()
        setError(d.error ?? 'Failed')
      }
    } else {
      // Finance submits request for approval
      const res = await fetch('/api/assets/edit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYearId: fyId, assetId: editModal.id, action: 'UPDATE', payload }),
      })
      if (res.ok) {
        setEditModal(null)
        showSuccess('Modification request submitted for approval.')
      } else {
        const d = await res.json()
        setError(d.error ?? 'Failed')
      }
    }
    setSaving(false)
  }

  async function handleDelete(asset: Asset) {
    if (!confirm(`Are you sure you want to delete/deactivate "${asset.name}"?`)) return
    setSaving(true)
    if (isAdmin) {
      const res = await fetch('/api/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: asset.id, isActive: false }),
      })
      if (res.ok) {
        loadAssets()
        showSuccess(`Asset "${asset.name}" deactivated.`)
      } else {
        const d = await res.json()
        alert(d.error ?? 'Failed to delete')
      }
    } else {
      const res = await fetch('/api/assets/edit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYearId: fyId, assetId: asset.id, action: 'DELETE', payload: { reason: 'User requested deletion' } }),
      })
      if (res.ok) showSuccess('Deletion request submitted for approval.')
      else { const d = await res.json(); alert(d.error ?? 'Failed') }
    }
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
    if (res.ok) { setMovModal(null); loadAssets(); showSuccess('Movement recorded.') }
    else { const d = await res.json(); setError(d.error ?? 'Failed') }
    setSaving(false)
  }

  async function handleApprove(reqId: string) {
    const res = await fetch('/api/assets/edit-request', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: reqId, decision: 'APPROVED' }),
    })
    if (res.ok) { loadRequests(); loadAssets(); showSuccess('Request approved and applied.') }
    else { const d = await res.json(); alert(d.error ?? 'Failed to approve') }
  }

  async function handleReject(reqId: string) {
    if (!confirm('Reject this request?')) return
    const res = await fetch('/api/assets/edit-request', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: reqId, decision: 'REJECTED' }),
    })
    if (res.ok) { loadRequests(); showSuccess('Request rejected.') }
    else { const d = await res.json(); alert(d.error ?? 'Failed to reject') }
  }

  const totalActive    = assets.filter(a => a.isActive).length
  const totalInactive  = assets.filter(a => !a.isActive).length
  const totalOpeningWdv = assets.reduce((s, a) => s + Number(a.yearBalances[0]?.openingWdv ?? 0), 0)
  const pendingCount   = editRequests.filter(r => r.status === 'PENDING').length

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Asset Register</h1>
          <p className="page-subtitle">FY {fyLabel} · Manage fixed assets, additions and disposals</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            id="assets-requests-btn"
            className="btn btn-secondary"
            onClick={() => setShowRequestsPanel(true)}
            style={{ position: 'relative' }}
          >
            {isAdmin ? 'Approval Requests' : 'Change Requests'}
            {pendingCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--red-400)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {pendingCount}
              </span>
            )}
          </button>
          <button id="assets-add-btn" className="btn btn-primary" onClick={() => { setAddForm({ name: '', category: 'Machinery', rateEnum: 'FIFTEEN', purchaseDate: '', openingWdv: '' }); setError(''); setShowAddModal(true) }}>
            + Add Asset
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: 'var(--green-400)', fontSize: 13.5 }}>
          ✓ {successMsg}
        </div>
      )}

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
          <p className="kpi-value">₹{Math.round(totalOpeningWdv).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
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
          <table className="mis-table" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 260 }}>#  Asset Name</th>
                <th>Category</th>
                <th>Rate</th>
                <th>Purchase Date</th>
                <th>Opening WDV (₹)</th>
                <th>Movements</th>
                <th>Status</th>
                <th style={{ width: 130 }}>Actions</th>
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
                    ₹{Math.round(Number(asset.yearBalances[0]?.openingWdv ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        id={`asset-edit-${idx}`}
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        title="Edit asset details (requires approval)"
                        onClick={() => openEditModal(asset)}
                      >✏ Edit</button>
                      {asset.isActive && (
                        <>
                          <button id={`asset-mov-${idx}`}
                            className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => { setMovModal(asset); setMovForm({ type: 'ADDITION', amount: '', date: '', notes: '' }); setError('') }}>
                            + Move
                          </button>
                          <button
                            id={`asset-del-${idx}`}
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red-400)' }}
                            title={isAdmin ? "Deactivate/Dispose asset" : "Request deletion (requires approval)"}
                            onClick={() => handleDelete(asset)}
                          >🗑</button>
                        </>
                      )}
                    </div>
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
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, width: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {isAdmin ? 'Add New Asset' : 'Request New Asset'}
            </h2>
            {!isAdmin && (
              <div style={{ fontSize: 12.5, color: 'var(--amber-400)', marginBottom: 14, background: 'rgba(251,191,36,0.08)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.2)' }}>
                ⚠ This request will be sent to Admin/CFO for approval before the asset is added.
              </div>
            )}
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
                  <input id="asset-opening-wdv" className="input" type="number" required step="1" min="0"
                    value={addForm.openingWdv}
                    onChange={e => setAddForm(p => ({ ...p, openingWdv: e.target.value }))}
                    placeholder="0" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" id="asset-add-submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Submitting…' : isAdmin ? 'Add Asset' : 'Submit Request'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, width: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Edit Asset</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>{editModal.name}</p>
            <div style={{ fontSize: 12.5, color: 'var(--amber-400)', marginBottom: 14, background: 'rgba(251,191,36,0.08)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.2)' }}>
              ⚠ Changes require approval from Admin/CFO before taking effect.
            </div>
            {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}
            <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Asset Name</label>
                <input className="input" required value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="select" value={editForm.category}
                    onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Depreciation Rate</label>
                  <select className="select" value={editForm.rateEnum}
                    onChange={e => setEditForm(p => ({ ...p, rateEnum: e.target.value }))}>
                    {RATE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input className="input" type="date" required value={editForm.purchaseDate}
                    onChange={e => setEditForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening WDV (₹) for FY {fyLabel}</label>
                  <input className="input" type="number" step="1" min="0"
                    value={editForm.openingWdv}
                    onChange={e => setEditForm(p => ({ ...p, openingWdv: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="select" value={editForm.isActive ? 'true' : 'false'}
                  onChange={e => setEditForm(p => ({ ...p, isActive: e.target.value === 'true' }))}>
                  <option value="true">Active</option>
                  <option value="false">Disposed / Inactive</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Submitting…' : 'Submit Edit Request'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)} style={{ flex: 1 }}>Cancel</button>
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
                  <input id="mov-amount" className="input" type="number" required step="1" min="0"
                    value={movForm.amount} onChange={e => setMovForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
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
                  ⚠ Disposal will mark the asset as <strong>inactive</strong>. Depreciation will be calculated up to the disposal month.
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

      {/* Edit Requests Side Panel */}
      {showRequestsPanel && isAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 560, background: 'var(--surface-1)', borderLeft: '1px solid var(--border-color)', height: '100vh', overflow: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600 }}>Asset Edit Requests</h2>
              <button className="btn btn-ghost" onClick={() => setShowRequestsPanel(false)}>✕ Close</button>
            </div>

            {reqLoading ? (
              <div className="skeleton" style={{ height: 300 }} />
            ) : editRequests.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No edit requests found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editRequests.map(req => {
                  const payload = JSON.parse(req.payload)
                  const isPending = req.status === 'PENDING'
                  return (
                    <div key={req.id} style={{
                      background: 'var(--surface-2)',
                      border: `1px solid ${isPending ? 'var(--border-color)' : req.status === 'APPROVED' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                      borderRadius: 12, padding: 16
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: req.action === 'CREATE' ? 'rgba(99,102,241,0.15)' : req.action === 'UPDATE' ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                          color: req.action === 'CREATE' ? 'var(--indigo-400)' : req.action === 'UPDATE' ? 'var(--amber-400)' : 'var(--red-400)',
                        }}>{req.action}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: isPending ? 'rgba(251,191,36,0.1)' : req.status === 'APPROVED' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                          color: isPending ? 'var(--amber-400)' : req.status === 'APPROVED' ? 'var(--green-400)' : 'var(--red-400)',
                        }}>{req.status}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        By <strong>{req.requestedBy.name}</strong> ({req.requestedBy.role}) · {new Date(req.createdAt).toLocaleString('en-IN')}
                      </p>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-3)', borderRadius: 6, padding: '8px 10px', marginBottom: 10 }}>
                        {Object.entries(payload).map(([k, v]) => (
                          <div key={k}><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{k}:</span> {String(v)}</div>
                        ))}
                      </div>
                      {isPending && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary" style={{ flex: 1, fontSize: 12.5 }} onClick={() => handleApprove(req.id)}>✓ Approve & Apply</button>
                          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12.5, color: 'var(--red-400)' }} onClick={() => handleReject(req.id)}>✕ Reject</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
