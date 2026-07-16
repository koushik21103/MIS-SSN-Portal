'use client'

import { useState, useEffect, useCallback } from 'react'

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

type AccountHead = { id: string; code: string; name: string; type: string; parentId: string | null; sortOrder: number }
type Actual = { accountHeadId: string; month: number; amount: number; notes?: string }

const TYPE_LABELS: Record<string, string> = {
  REVENUE: 'Revenue', COGS: 'Cost of Sales', DIRECT_EXPENSE: 'Direct Expenses',
  INDIRECT_INCOME: 'Indirect Income', INDIRECT_EXPENSE: 'Indirect Expenses',
}
const TYPE_ORDER = ['REVENUE', 'COGS', 'DIRECT_EXPENSE', 'INDIRECT_INCOME', 'INDIRECT_EXPENSE']

export default function ActualsPage() {
  const [fyId, setFyId]         = useState('')
  const [fyLabel, setFyLabel]   = useState('')
  const [month, setMonth]       = useState(1)
  const [heads, setHeads]       = useState<AccountHead[]>([])
  const [actualMap, setActualMap] = useState<Record<string, number>>({})
  const [noteMap, setNoteMap]   = useState<Record<string, string>>({})
  const [dirty, setDirty]       = useState<Record<string, boolean>>({})
  const [saving, setSaving]     = useState<Record<string, boolean>>({})
  const [saved, setSaved]       = useState<Record<string, boolean>>({})
  const [periodStatus, setPeriodStatus] = useState<string>('OPEN')
  const [loading, setLoading]   = useState(true)

  // Load FY and heads once
  useEffect(() => {
    async function loadFY() {
      const fyRes  = await fetch('/api/fy/active')
      const fyData = await fyRes.json()
      if (!fyData?.id) { setLoading(false); return }
      setFyId(fyData.id)
      setFyLabel(fyData.label)

      const budRes  = await fetch(`/api/budget?fyId=${fyData.id}`)
      const budData = await budRes.json()
      const entryHeads = budData.heads.filter((h: AccountHead) =>
        !['GROSS_PROFIT', 'NET_PROFIT'].includes(h.code)
      )
      setHeads(entryHeads)

      // Detect current fiscal month (April = 1)
      const now = new Date()
      const fm = now.getMonth() >= 3 ? now.getMonth() - 2 : now.getMonth() + 10
      setMonth(Math.min(fm, 12))
    }
    loadFY()
  }, [])

  // Load actuals for selected month
  useEffect(() => {
    if (!fyId || !month) return
    setLoading(true)
    async function loadActuals() {
      const [actualsRes, periodsRes] = await Promise.all([
        fetch(`/api/actuals?fyId=${fyId}&month=${month}`),
        fetch(`/api/periods?fyId=${fyId}`),
      ])
      const actualsData = await actualsRes.json()
      const periodsData = await periodsRes.json()

      const map: Record<string, number> = {}
      const notes: Record<string, string> = {}
      for (const a of actualsData) {
        map[a.accountHeadId]   = Number(a.amount)
        if (a.notes) notes[a.accountHeadId] = a.notes
      }
      setActualMap(map)
      setNoteMap(notes)

      const periodForMonth = periodsData.find((p: any) => p.month === month)
      setPeriodStatus(periodForMonth?.status ?? 'OPEN')
      setDirty({})
      setSaved({})
      setLoading(false)
    }
    loadActuals()
  }, [fyId, month])

  function handleChange(headId: string, raw: string) {
    const val = parseFloat(raw.replace(/,/g, '')) || 0
    setActualMap(prev => ({ ...prev, [headId]: val }))
    setDirty(prev => ({ ...prev, [headId]: true }))
    setSaved(prev => ({ ...prev, [headId]: false }))
  }

  const saveRow = useCallback(async (headId: string) => {
    if (!fyId || !dirty[headId] || periodStatus === 'LOCKED') return
    setSaving(prev => ({ ...prev, [headId]: true }))
    const res = await fetch('/api/actuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        financialYearId: fyId,
        accountHeadId:   headId,
        month,
        amount:          actualMap[headId] ?? 0,
        notes:           noteMap[headId],
      }),
    })
    setSaving(prev => ({ ...prev, [headId]: false }))
    if (res.ok) {
      setDirty(prev => ({ ...prev, [headId]: false }))
      setSaved(prev => ({ ...prev, [headId]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [headId]: false })), 2000)
    }
  }, [fyId, dirty, month, actualMap, noteMap, periodStatus])

  const isLocked = periodStatus === 'LOCKED'
  const grouped  = heads.reduce((acc: Record<string, AccountHead[]>, h) => {
    if (!acc[h.type]) acc[h.type] = []
    acc[h.type].push(h)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Actuals Entry</h1>
          <p className="page-subtitle">FY {fyLabel} · Enter actual values for the selected month</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Period status badge */}
          <span className={`role-badge ${isLocked ? 'role-viewer' : 'role-finance'}`}>
            {periodStatus}
          </span>
          {/* Month selector */}
          <select
            id="actuals-month-select"
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            className="select"
            style={{ width: 140 }}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m} {i < 9 ? '2026' : '2027'}</option>
            ))}
          </select>
        </div>
      </div>

      {isLocked && (
        <div className="login-error" style={{ marginBottom: 20 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          This period is locked. Contact Admin to unlock.
        </div>
      )}

      {loading ? (
        <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>
      ) : (
        <div className="table-wrapper">
          <table className="mis-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 260 }}>Account Head</th>
                <th style={{ minWidth: 180 }}>Actual Amount (₹)</th>
                <th style={{ minWidth: 220 }}>Notes</th>
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map(type => {
                const typeHeads = grouped[type] ?? []
                if (!typeHeads.length) return null
                return [
                  <tr key={`hdr-${type}`} className="row-header">
                    <td colSpan={4}>{TYPE_LABELS[type]}</td>
                  </tr>,
                  ...typeHeads.map(head => {
                    const val    = actualMap[head.id] ?? 0
                    const isChild = !!head.parentId
                    return (
                      <tr key={head.id}>
                        <td style={{ paddingLeft: isChild ? 28 : 14, fontSize: isChild ? '12.5px' : '13px', color: isChild ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                          {head.name}
                        </td>
                        <td style={{ padding: '3px 6px' }}>
                          <input
                            type="text"
                            id={`actual-${head.code}`}
                            disabled={isLocked}
                            defaultValue={val > 0 ? val.toLocaleString('en-IN') : ''}
                            onFocus={e => e.target.select()}
                            onChange={e => handleChange(head.id, e.target.value)}
                            onBlur={() => saveRow(head.id)}
                            placeholder="0"
                            aria-label={`${head.name} actual amount`}
                            className="input"
                            style={{ maxWidth: 170, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: isLocked ? 0.5 : 1 }}
                          />
                        </td>
                        <td style={{ padding: '3px 6px' }}>
                          <input
                            type="text"
                            id={`note-${head.code}`}
                            disabled={isLocked}
                            defaultValue={noteMap[head.id] ?? ''}
                            onChange={e => {
                              setNoteMap(prev => ({ ...prev, [head.id]: e.target.value }))
                              setDirty(prev => ({ ...prev, [head.id]: true }))
                            }}
                            onBlur={() => saveRow(head.id)}
                            placeholder="Optional note…"
                            className="input"
                            style={{ opacity: isLocked ? 0.5 : 1 }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {saving[head.id] ? (
                            <svg className="spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="14" height="14" style={{ color: 'var(--text-muted)' }}>
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : saved[head.id] ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="var(--green-400)" width="14" height="14">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                          ) : null}
                        </td>
                      </tr>
                    )
                  }),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
