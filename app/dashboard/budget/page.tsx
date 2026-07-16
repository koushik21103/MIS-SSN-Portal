'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

type AccountHead = {
  id: string; code: string; name: string; type: string;
  segment: string; parentId: string | null; sortOrder: number; allowedType: string;
}
type Budget = {
  accountHeadId: string;
  m1: number; m2: number; m3: number; m4: number; m5: number; m6: number;
  m7: number; m8: number; m9: number; m10: number; m11: number; m12: number;
  annualAmount: number;
}

function fmt(n: number) {
  if (n === 0) return ''
  return n.toLocaleString('en-IN')
}

const TYPE_LABELS: Record<string, string> = {
  REVENUE: 'Revenue', COGS: 'Cost of Sales', DIRECT_EXPENSE: 'Direct Expenses',
  INDIRECT_INCOME: 'Indirect Income', INDIRECT_EXPENSE: 'Indirect Expenses',
}

export default function BudgetPage() {
  const { data: session } = useSession()
  const [fyId, setFyId]     = useState<string>('')
  const [fyLabel, setFyLabel] = useState<string>('')
  const [heads, setHeads]   = useState<AccountHead[]>([])
  const [budgetMap, setBudgetMap] = useState<Record<string, Budget>>({})
  const [dirty, setDirty]   = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved]   = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Fetch FY and budget data
  useEffect(() => {
    async function load() {
      const fyRes  = await fetch('/api/fy/active')
      const fyData = await fyRes.json()
      if (!fyData?.id) { setLoading(false); return }
      setFyId(fyData.id)
      setFyLabel(fyData.label)

      const res  = await fetch(`/api/budget?fyId=${fyData.id}`)
      const data = await res.json()

      const map: Record<string, Budget> = {}
      for (const b of data.budgets) {
        map[b.accountHeadId] = {
          accountHeadId: b.accountHeadId,
          m1: Number(b.m1), m2: Number(b.m2), m3: Number(b.m3), m4: Number(b.m4),
          m5: Number(b.m5), m6: Number(b.m6), m7: Number(b.m7), m8: Number(b.m8),
          m9: Number(b.m9), m10: Number(b.m10), m11: Number(b.m11), m12: Number(b.m12),
          annualAmount: Number(b.annualAmount),
        }
      }
      setBudgetMap(map)
      // Sort heads excluding computed totals
      const entryHeads = data.heads.filter((h: AccountHead) =>
        !['GROSS_PROFIT', 'NET_PROFIT'].includes(h.code)
      )
      setHeads(entryHeads)
      setLoading(false)
    }
    load()
  }, [])

  function getValue(headId: string, m: number): number {
    return budgetMap[headId]?.[`m${m}` as keyof Budget] as number ?? 0
  }

  function handleChange(headId: string, m: number, raw: string) {
    const val = parseFloat(raw.replace(/,/g, '')) || 0
    setBudgetMap(prev => {
      const existing = prev[headId] ?? { accountHeadId: headId, m1:0,m2:0,m3:0,m4:0,m5:0,m6:0,m7:0,m8:0,m9:0,m10:0,m11:0,m12:0, annualAmount:0 }
      const updated  = { ...existing, [`m${m}`]: val }
      const annual   = Array.from({length:12}, (_,i)=> updated[`m${i+1}` as keyof Budget] as number).reduce((s,v)=>s+v,0)
      return { ...prev, [headId]: { ...updated, annualAmount: annual } }
    })
    setDirty(prev => ({ ...prev, [headId]: true }))
    setSaved(prev => ({ ...prev, [headId]: false }))
  }

  const saveRow = useCallback(async (headId: string) => {
    if (!fyId || !dirty[headId]) return
    setSaving(prev => ({ ...prev, [headId]: true }))
    const b = budgetMap[headId]
    await fetch('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financialYearId: fyId, accountHeadId: headId, ...b }),
    })
    setSaving(prev => ({ ...prev, [headId]: false }))
    setDirty(prev => ({ ...prev, [headId]: false }))
    setSaved(prev => ({ ...prev, [headId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [headId]: false })), 2000)
  }, [fyId, dirty, budgetMap])

  // Group heads by type
  const grouped = heads.reduce((acc: Record<string, AccountHead[]>, h) => {
    if (!acc[h.type]) acc[h.type] = []
    acc[h.type].push(h)
    return acc
  }, {})

  const TYPE_ORDER = ['REVENUE', 'COGS', 'DIRECT_EXPENSE', 'INDIRECT_INCOME', 'INDIRECT_EXPENSE']

  if (loading) return (
    <div>
      <div className="page-header"><h1 className="page-title">Budget Entry</h1></div>
      <div className="card"><div className="skeleton" style={{height:400}} /></div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Budget Entry</h1>
        <p className="page-subtitle">FY {fyLabel} · Click any cell to edit. Changes auto-save on blur.</p>
      </div>

      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="mis-table" style={{ minWidth: 1400 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: 260, position: 'sticky', left: 0, background: 'var(--surface-1)', zIndex: 2 }}>Account Head</th>
              {MONTHS.map((m, i) => <th key={i}>{m}</th>)}
              <th style={{ color: 'var(--indigo-400)' }}>Annual</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {TYPE_ORDER.map(type => {
              const typeHeads = grouped[type] ?? []
              if (!typeHeads.length) return null
              return [
                <tr key={`header-${type}`} className="row-header">
                  <td colSpan={15}>{TYPE_LABELS[type]}</td>
                </tr>,
                ...typeHeads.map(head => {
                  const isChild = !!head.parentId
                  const annual  = budgetMap[head.id]?.annualAmount ?? 0
                  return (
                    <tr key={head.id}>
                      <td style={{
                        position: 'sticky', left: 0,
                        background: 'var(--surface-2)', zIndex: 1,
                        paddingLeft: isChild ? 28 : 14,
                        fontSize: isChild ? '12.5px' : '13px',
                        color: isChild ? 'var(--text-secondary)' : 'var(--text-primary)',
                      }}>
                        {head.name}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m   = i + 1
                        const val = getValue(head.id, m)
                        return (
                          <td key={m} style={{ padding: '3px 4px' }}>
                            <input
                              type="text"
                              className="budget-cell-input"
                              defaultValue={val > 0 ? val.toLocaleString('en-IN') : ''}
                              onFocus={e => e.target.select()}
                              onChange={e => handleChange(head.id, m, e.target.value)}
                              onBlur={() => saveRow(head.id)}
                              id={`budget-${head.code}-m${m}`}
                              aria-label={`${head.name} ${MONTHS[i]}`}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: '1px solid transparent',
                                borderRadius: 5,
                                padding: '5px 8px',
                                textAlign: 'right',
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                fontVariantNumeric: 'tabular-nums',
                                outline: 'none',
                              }}
                              onFocusCapture={e => {
                                ;(e.target as HTMLInputElement).style.border = '1px solid var(--indigo-500)'
                                ;(e.target as HTMLInputElement).style.background = 'rgba(99,102,241,0.06)'
                              }}
                              onBlurCapture={e => {
                                ;(e.target as HTMLInputElement).style.border = '1px solid transparent'
                                ;(e.target as HTMLInputElement).style.background = 'transparent'
                              }}
                            />
                          </td>
                        )
                      })}
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--indigo-400)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                        {annual > 0 ? annual.toLocaleString('en-IN') : '—'}
                      </td>
                      <td style={{ textAlign: 'center', width: 48 }}>
                        {saving[head.id] ? (
                          <svg className="spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="14" height="14" style={{color:'var(--text-muted)'}}>
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
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

      <style>{`
        .budget-cell-input:hover { border-color: rgba(99,102,241,0.3) !important; background: rgba(99,102,241,0.03) !important; }
        .budget-cell-input::placeholder { color: var(--gray-700); }
      `}</style>
    </div>
  )
}
