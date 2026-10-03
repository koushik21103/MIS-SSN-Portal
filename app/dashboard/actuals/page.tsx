'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useFY } from '@/components/FYProvider'

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

type AccountHead = { id: string; code: string; name: string; type: string; parentId: string | null; sortOrder: number }
type Period = { month: number; status: string }

const TYPE_LABELS: Record<string, string> = {
  REVENUE: 'Revenue', COGS: 'Cost of Sales', DIRECT_EXPENSE: 'Direct Expenses',
  INDIRECT_INCOME: 'Indirect Income', INDIRECT_EXPENSE: 'Indirect Expenses',
}
const TYPE_ORDER = ['REVENUE', 'COGS', 'DIRECT_EXPENSE', 'INDIRECT_INCOME', 'INDIRECT_EXPENSE']

export default function ActualsPage() {
  const { fyId, fyLabel } = useFY()
  const [month, setMonth] = useState(1)
  const [heads, setHeads] = useState<AccountHead[]>([])
  const [actualMap, setActualMap] = useState<Record<string, number>>({})
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [periodStatus, setPeriodStatus] = useState<string>('OPEN')
  const [currentPeriod, setCurrentPeriod] = useState<any>(null)
  const [allPeriods, setAllPeriods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [prevCloseStock, setPrevCloseStock] = useState<number | null>(null)

  // Load heads once
  useEffect(() => {
    async function loadHeads() {
      if (!fyId) return
      const budRes = await fetch(`/api/budget?fyId=${fyId}`)
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
    loadHeads()
  }, [fyId])

  // Load actuals for selected month
  useEffect(() => {
    if (!fyId || !month) return
    setLoading(true)
    async function loadActuals() {
      const [actualsRes, periodsRes] = await Promise.all([
        fetch(`/api/actuals?fyId=${fyId}&month=${month}`),
        fetch(`/api/periods?fyId=${fyId}`),
      ])
      const actualsDataJson = await actualsRes.json()
      const periodsData = await periodsRes.json()

      const aData = actualsDataJson.actuals || []
      const pStock = actualsDataJson.prevCloseStock ?? null

      const map: Record<string, number> = {}
      const notes: Record<string, string> = {}
      for (const a of aData) {
        map[a.accountHeadId] = Number(a.amount)
        if (a.notes) notes[a.accountHeadId] = a.notes
      }

      setPrevCloseStock(pStock)

      // Automatically override OPEN_STOCK if we have prevCloseStock
      const openStockHead = heads.find(h => h.code === 'OPEN_STOCK')
      if (openStockHead && pStock !== null) {
        map[openStockHead.id] = pStock
      }

      setActualMap(map)
      setNoteMap(notes)

      setAllPeriods(periodsData)
      const periodForMonth = periodsData.find((p: any) => p.month === month)
      setPeriodStatus(periodForMonth?.status ?? 'OPEN')
      setCurrentPeriod(periodForMonth)
      setDirty({})
      setSaved({})
      setLoading(false)
    }
    loadActuals()
  }, [fyId, month])

  function handleChange(headId: string, raw: string) {
    let val = parseFloat(raw.replace(/,/g, '')) || 0
    val = Math.round(val)
    setActualMap(prev => ({ ...prev, [headId]: val }))
    setDirty(prev => ({ ...prev, [headId]: true }))
    setSaved(prev => ({ ...prev, [headId]: false }))
  }

  const actualMapRef = useRef(actualMap)
  useEffect(() => { actualMapRef.current = actualMap }, [actualMap])

  const noteMapRef = useRef(noteMap)
  useEffect(() => { noteMapRef.current = noteMap }, [noteMap])

  const dirtyRef = useRef(dirty)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  const [isClosing, setIsClosing] = useState(false)

  async function handleCloseMonth() {
    if (!confirm(`Are you sure you want to close Month ${month}? This unlocks the next month for entry.`)) return
    if (!fyId || periodStatus === 'LOCKED') return
    setIsClosing(true)

    const dirtyKeys = Object.keys(dirtyRef.current).filter(k => dirtyRef.current[k])
    
    // Check if there's at least one entry
    const hasAnyEntry = Object.values(actualMapRef.current).some(v => v !== 0)
    if (!hasAnyEntry && dirtyKeys.length === 0) {
      alert("Cannot submit month without any actual entries.")
      setIsClosing(false)
      return
    }

    try {
      if (dirtyKeys.length > 0) {
        const payload = dirtyKeys.map(headId => ({
          financialYearId: fyId,
          accountHeadId: headId,
          month,
          amount: actualMapRef.current[headId] ?? 0,
          notes: noteMapRef.current[headId]
        }))
        const batchRes = await fetch('/api/actuals/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!batchRes.ok) {
          const data = await batchRes.json()
          alert(data.error || 'Failed to save data before closing.')
          setIsClosing(false)
          return
        }
        setDirty({})
        setSaved(dirtyKeys.reduce((acc, k) => ({...acc, [k]: true}), {}))
        setTimeout(() => setSaved({}), 2000)
      }

      const res = await fetch('/api/periods/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYearId: fyId, month })
      })
      if (res.ok) {
        const updated = await res.json()
        setCurrentPeriod(updated)
        setAllPeriods(prev => prev.map(p => p.month === month ? updated : p))
        alert('Month closed successfully.')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to close month.')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsClosing(false)
    }
  }

  const isLocked = periodStatus === 'LOCKED'
  const grouped = heads.reduce((acc: Record<string, AccountHead[]>, h) => {
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
            style={{ width: 170 }}
          >
            {MONTHS.map((m, i) => {
              const mNum = i + 1;
              let isDisabled = false;
              if (mNum > 1) {
                const prev = allPeriods.find(p => p.month === mNum - 1);
                if (!prev || !prev.submittedAt) isDisabled = true;
              }
              const currentP = allPeriods.find(p => p.month === mNum);
              if (currentP?.status === 'LOCKED') isDisabled = true;
              
              return (
                <option key={i} value={mNum} disabled={isDisabled}>
                  {m} {i < 9 ? '2026' : '2027'} {isDisabled ? '(Locked)' : ''}
                </option>
              )
            })}
          </select>
          {/* Action Buttons */}
          {(!currentPeriod?.submittedAt || periodStatus === 'OPEN' || periodStatus === 'PENDING_REVIEW') && !isLocked && (
            <button 
              onClick={handleCloseMonth}
              disabled={isClosing || (!!currentPeriod?.submittedAt && !Object.values(dirty).some(v => v))}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: 13 }}
            >
              {isClosing ? 'Closing...' : (Object.values(dirty).some(v => v) ? 'Submit Updates' : (currentPeriod?.submittedAt ? 'Submitted' : 'Close Month'))}
            </button>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="login-error" style={{ marginBottom: 20 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
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
              {(() => {
                const getRowVal = (code: string) => actualMap[heads.find(x => x.code === code)?.id ?? ''] ?? 0
                const getChildrenSum = (parentCode: string) => {
                  const p = heads.find(x => x.code === parentCode)
                  if (!p) return 0
                  return heads.filter(h => h.parentId === p.id).reduce((sum, h) => sum + (actualMap[h.id] ?? 0), 0)
                }

                const totalSales = getChildrenSum('SALES_TOTAL')
                const purchObj = getChildrenSum('PURCH_TOTAL')
                const consumpObj = getRowVal('OPEN_STOCK') + purchObj - getRowVal('CLOSE_STOCK')
                const dirExpObj = getChildrenSum('DIREXP_TOTAL')
                const cogsObj = consumpObj + dirExpObj
                const gpObj = totalSales - cogsObj
                const indIncObj = getChildrenSum('INDINC_TOTAL')
                const indExpObj = getChildrenSum('INDEXP_TOTAL')
                const npObj = gpObj + indIncObj - indExpObj

                const renderRowByCode = (code: string) => {
                  const head = heads.find(h => h.code === code)
                  if (!head) return null
                  const val = actualMap[head.id] ?? 0
                  const isChild = !!head.parentId

                  // Read-only logic is handled on the budget side, but actuals are fully enterable here, except cross-sheet we don't have them yet, or do we?
                  // Actually, the user enters actuals on the actuals page! So no read-only here unless locked.

                  return (
                    <tr key={head.id}>
                      <td style={{
                        position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 1,
                        paddingLeft: isChild ? 28 : 14, fontSize: isChild ? '12.5px' : '13px',
                        color: isChild ? 'var(--text-secondary)' : 'var(--text-primary)',
                      }}>
                        {head.name}
                      </td>
                      <td style={{ padding: '3px 6px' }}>
                        <input
                          type="text"
                          id={`actual-${head.code}`}
                          disabled={isLocked || (head.code === 'OPEN_STOCK' && prevCloseStock !== null)}
                          defaultValue={val !== 0 ? Math.round(val).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : ''}
                          onFocus={e => e.target.select()}
                          onChange={e => handleChange(head.id, e.target.value)}
                          placeholder="—"
                          aria-label={`${head.name} actual amount`}
                          className="input"
                          style={{ maxWidth: 170, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: (isLocked || (head.code === 'OPEN_STOCK' && prevCloseStock !== null)) ? 0.5 : 1 }}
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
                          placeholder="Optional note…"
                          className="input"
                          style={{ opacity: isLocked ? 0.5 : 1 }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {saving[head.id] ? (
                          <svg className="spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="14" height="14" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : saved[head.id] ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="var(--green-400)" width="14" height="14"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        ) : null}
                      </td>
                    </tr>
                  )
                }

                const renderSubtotalRow = (label: string, computed: number, level: 'primary' | 'secondary' | 'tertiary' = 'secondary') => {
                  let bg = 'var(--surface-3)'
                  let color = 'var(--text-primary)'
                  let highlight = 'var(--indigo-400)'

                  if (level === 'primary') {
                    bg = 'var(--indigo-600)'
                    color = '#fff'
                    highlight = '#fff'
                  } else if (level === 'tertiary') {
                    bg = 'var(--surface-2)'
                  }

                  return (
                    <tr key={`subtotal-${label}`} style={{ background: bg, fontWeight: 600 }}>
                      <td style={{ position: 'sticky', left: 0, background: bg, zIndex: 1, paddingLeft: 14, color: color }}>{label}</td>
                      <td style={{ textAlign: 'right', padding: '6px 20px', color: highlight, fontVariantNumeric: 'tabular-nums' }}>
                        {computed !== 0 ? Math.round(computed).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  )
                }

                const salesChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'SALES_TOTAL')?.id).sort((a, b) => a.sortOrder - b.sortOrder)
                const purchChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'PURCH_TOTAL')?.id).sort((a, b) => a.sortOrder - b.sortOrder)
                const dirExpChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'DIREXP_TOTAL')?.id).sort((a, b) => a.sortOrder - b.sortOrder)
                const indIncChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'INDINC_TOTAL')?.id).sort((a, b) => a.sortOrder - b.sortOrder)
                const indExpChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'INDEXP_TOTAL')?.id).sort((a, b) => a.sortOrder - b.sortOrder)

                return (
                  <>
                    {renderSubtotalRow('Sales Accounts', totalSales, 'secondary')}
                    {salesChildren.map(h => renderRowByCode(h.code))}

                    {renderSubtotalRow('Cost of Sales', cogsObj, 'secondary')}
                    {renderRowByCode('OPEN_STOCK')}
                    {renderSubtotalRow('Add: Purchase Accounts', purchObj, 'tertiary')}
                    {purchChildren.map(h => renderRowByCode(h.code))}

                    {renderRowByCode('CLOSE_STOCK')}
                    {renderSubtotalRow('Consumption', consumpObj, 'tertiary')}

                    {renderSubtotalRow('Direct Expenses', dirExpObj, 'tertiary')}
                    {dirExpChildren.map(h => renderRowByCode(h.code))}

                    {renderSubtotalRow('Gross Profit', gpObj, 'primary')}

                    {renderSubtotalRow('Indirect Incomes', indIncObj, 'secondary')}
                    {indIncChildren.map(h => renderRowByCode(h.code))}

                    {renderSubtotalRow('Indirect Expenses', indExpObj, 'secondary')}
                    {indExpChildren.map(h => renderRowByCode(h.code))}

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
