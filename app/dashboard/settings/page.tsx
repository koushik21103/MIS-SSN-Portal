'use client'

import { useState, useEffect } from 'react'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
const MONTH_YEARS = MONTHS.map((m, i) => `${m} ${i < 9 ? '2026' : '2027'}`)

type Period = { id: string; month: number; status: 'OPEN' | 'PENDING_REVIEW' | 'LOCKED'; financialYearId: string }

const STATUS_CYCLE = { OPEN: 'PENDING_REVIEW', PENDING_REVIEW: 'LOCKED', LOCKED: 'OPEN' } as const
const STATUS_LABEL = { OPEN: 'Open', PENDING_REVIEW: 'Pending Review', LOCKED: 'Locked' }
const STATUS_COLOR = { OPEN: 'role-finance', PENDING_REVIEW: 'role-cfo', LOCKED: 'role-viewer' }

export default function SettingsPage() {
  const [fyId, setFyId]     = useState('')
  const [fyLabel, setFyLabel] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const fyRes  = await fetch('/api/fy/active')
      const fyData = await fyRes.json()
      if (!fyData?.id) { setLoading(false); return }
      setFyId(fyData.id)
      setFyLabel(fyData.label)

      const pRes  = await fetch(`/api/periods?fyId=${fyData.id}`)
      const pData = await pRes.json()
      setPeriods(pData)
      setLoading(false)
    }
    load()
  }, [])

  async function cyclePeriodStatus(period: Period) {
    const nextStatus = STATUS_CYCLE[period.status]
    setUpdating(period.id)
    const res = await fetch('/api/periods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: period.id, status: nextStatus }),
    })
    if (res.ok) {
      setPeriods(prev => prev.map(p => p.id === period.id ? { ...p, status: nextStatus } : p))
    }
    setUpdating(null)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">FY {fyLabel} · Manage period status and configuration</p>
      </div>

      {/* Period Management */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
          Period Management
        </h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: 20 }}>
          Click the status button to cycle: Open → Pending Review → Locked. Locked periods cannot accept actuals.
        </p>

        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {periods.map(p => (
              <div key={p.id} style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {MONTH_YEARS[p.month - 1]}
                </span>
                <span className={`role-badge ${STATUS_COLOR[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                <button
                  id={`period-toggle-${p.month}`}
                  disabled={updating === p.id}
                  className="btn btn-secondary"
                  style={{ fontSize: 11.5, padding: '5px 10px', width: '100%' }}
                  onClick={() => cyclePeriodStatus(p)}
                >
                  {updating === p.id ? '…' : `→ ${STATUS_LABEL[STATUS_CYCLE[p.status]]}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card">
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          Status Reference
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '13px' }}>
              <span className={`role-badge ${STATUS_COLOR[k as keyof typeof STATUS_COLOR]}`}>{label}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {k === 'OPEN' && 'Finance can enter/edit actuals for this period'}
                {k === 'PENDING_REVIEW' && 'Actuals submitted — under review by CFO. No edits.'}
                {k === 'LOCKED' && 'Period closed and locked. No changes allowed. Contact Admin to unlock.'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
