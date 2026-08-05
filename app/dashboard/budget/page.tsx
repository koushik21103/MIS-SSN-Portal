'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useFY } from '@/components/FYProvider'

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
  baseAmount?: number;
  growthRate?: number;
}

function fmt(n: number) {
  if (n === 0) return ''
  return n.toLocaleString('en-IN')
}

const TYPE_LABELS: Record<string, string> = {
  REVENUE: 'Revenue', COGS: 'Cost of Sales', DIRECT_EXPENSE: 'Direct Expenses',
  INDIRECT_INCOME: 'Indirect Income', INDIRECT_EXPENSE: 'Indirect Expenses',
}

const BudgetCell = ({ value, onChange, onBlur, className, style, onFocusCapture, onBlurCapture }: any) => {
  const [localVal, setLocalVal] = useState(value ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '')

  useEffect(() => {
    const parsedLocal = parseFloat(localVal.replace(/,/g, '')) || 0
    if (Math.abs(parsedLocal - (value || 0)) > 0.001) {
      setLocalVal(value ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '')
    }
  }, [value])

  return (
    <input 
      type="text"
      className={className}
      value={localVal}
      onChange={e => {
        setLocalVal(e.target.value)
        onChange(e.target.value)
      }}
      onBlur={e => {
        const p = parseFloat(e.target.value.replace(/,/g, '')) || 0
        setLocalVal(p ? p.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '')
        if (onBlur) onBlur()
      }}
      onFocus={e => e.target.select()}
      style={style}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    />
  )
}

export default function BudgetPage() {
  const { data: session } = useSession()
  const { fyId, fyLabel } = useFY()
  const [heads, setHeads]   = useState<AccountHead[]>([])
  const [budgetMap, setBudgetMap] = useState<Record<string, Budget>>({})
  const [dirty, setDirty]   = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved]   = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Fetch budget data
  useEffect(() => {
    if (!fyId) { setLoading(false); return }
    async function load() {
      const res  = await fetch(`/api/budget?fyId=${fyId}`)
      const data = await res.json()

      const map: Record<string, Budget> = {}
      for (const b of data.budgets) {
        map[b.accountHeadId] = {
          accountHeadId: b.accountHeadId,
          m1: Number(b.m1), m2: Number(b.m2), m3: Number(b.m3), m4: Number(b.m4),
          m5: Number(b.m5), m6: Number(b.m6), m7: Number(b.m7), m8: Number(b.m8),
          m9: Number(b.m9), m10: Number(b.m10), m11: Number(b.m11), m12: Number(b.m12),
          annualAmount: Number(b.annualAmount),
          baseAmount: b.baseAmount != null ? Number(b.baseAmount) : undefined,
          growthRate: b.growthRate != null ? Number(b.growthRate) : undefined,
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

  function handleChange(headId: string, raw: string) {
    const val = parseFloat(raw.replace(/,/g, ''))
    const newAnnual = isNaN(val) ? 0 : val
    
    setBudgetMap(prev => {
      const existing = prev[headId] ?? { accountHeadId: headId, m1:0,m2:0,m3:0,m4:0,m5:0,m6:0,m7:0,m8:0,m9:0,m10:0,m11:0,m12:0, annualAmount:0 }
      
      const headCode = heads.find(h => h.id === headId)?.code
      const isStock = headCode === 'OPEN_STOCK' || headCode === 'CLOSE_STOCK'

      const monthlyVal = isStock ? 0 : Number((newAnnual / 12).toFixed(2));
      const m12Val = isStock ? 0 : Number((newAnnual - (monthlyVal * 11)).toFixed(2));

      return { 
        ...prev, 
        [headId]: { 
          ...existing, 
          baseAmount: undefined,
          growthRate: undefined,
          annualAmount: newAnnual,
          m1: monthlyVal, m2: monthlyVal, m3: monthlyVal, m4: monthlyVal,
          m5: monthlyVal, m6: monthlyVal, m7: monthlyVal, m8: monthlyVal,
          m9: monthlyVal, m10: monthlyVal, m11: monthlyVal, m12: m12Val
        } 
      }
    })
    setDirty(prev => ({ ...prev, [headId]: true }))
    setSaved(prev => ({ ...prev, [headId]: false }))
  }

  function handleMonthChange(headId: string, monthIndex: number, raw: string) {
    const val = parseFloat(raw.replace(/,/g, ''))
    const newMonthVal = isNaN(val) ? 0 : val
    const mKey = `m${monthIndex}` as keyof Budget

    setBudgetMap(prev => {
      const existing = prev[headId] ?? { accountHeadId: headId, m1:0,m2:0,m3:0,m4:0,m5:0,m6:0,m7:0,m8:0,m9:0,m10:0,m11:0,m12:0, annualAmount:0 }
      const updated = { ...existing, [mKey]: newMonthVal, baseAmount: undefined, growthRate: undefined }
      
      const newAnnual = [1,2,3,4,5,6,7,8,9,10,11,12].reduce((sum, m) => sum + (updated[`m${m}` as keyof Budget] as number), 0)
      updated.annualAmount = Number(newAnnual.toFixed(2))

      return { ...prev, [headId]: updated as Budget }
    })
    setDirty(prev => ({ ...prev, [headId]: true }))
    setSaved(prev => ({ ...prev, [headId]: false }))
  }

  async function handleRename(id: string, name: string) {
    if (!name.trim()) return
    const orig = heads.find(h => h.id === id)
    if (orig && orig.name === name) return
    setHeads(prev => prev.map(h => h.id === id ? { ...h, name } : h))
    try {
      await fetch('/api/account-heads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name })
      })
    } catch (e) { console.error(e) }
  }

  async function handleAddRow(parentCode: string, type: string) {
    const parentId = heads.find(h => h.code === parentCode)?.id
    if (!parentId) return
    try {
      const res = await fetch('/api/account-heads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Item', parentId, type })
      })
      const data = await res.json()
      if (data.head) {
        setHeads(prev => [...prev, data.head].sort((a, b) => a.sortOrder - b.sortOrder))
      }
    } catch (e) { console.error(e) }
  }

  async function handleDeleteRow(id: string) {
    if (!confirm('Are you sure you want to delete this row? This will also remove any budget data entered for it.')) return
    
    // Optimistically remove from UI
    setHeads(prev => prev.filter(h => h.id !== id))
    
    try {
      await fetch(`/api/account-heads?id=${id}`, {
        method: 'DELETE'
      })
    } catch (e) {
      console.error(e)
    }
  }

  const budgetMapRef = useRef(budgetMap)
  useEffect(() => { budgetMapRef.current = budgetMap }, [budgetMap])

  const dirtyRef = useRef(dirty)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  const saveRow = useCallback((headId: string) => {
    if (!fyId) return
    // Defer the save to ensure React state (setBudgetMap) has settled before reading the ref
    setTimeout(async () => {
      if (!dirtyRef.current[headId]) return
      setSaving(prev => ({ ...prev, [headId]: true }))
      
      const b = budgetMapRef.current[headId]
      if (!b) return
      
      try {
        await fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ financialYearId: fyId, ...b }),
        })
        setDirty(prev => ({ ...prev, [headId]: false }))
        setSaved(prev => ({ ...prev, [headId]: true }))
        setTimeout(() => setSaved(prev => ({ ...prev, [headId]: false })), 2000)
      } catch (err) {
        console.error(err)
      } finally {
        setSaving(prev => ({ ...prev, [headId]: false }))
      }
    }, 150)
  }, [fyId, dirty])

  // Group heads by type
  const grouped = heads.reduce((acc: Record<string, AccountHead[]>, h) => {
    if (!acc[h.type]) acc[h.type] = []
    acc[h.type].push(h)
    return acc
  }, {})

  const TYPE_ORDER = ['REVENUE', 'COGS', 'DIRECT_EXPENSE', 'INDIRECT_INCOME', 'INDIRECT_EXPENSE']

  const sumObjs = (a: any, b: any) => ({
    annual: (a?.annual || 0) + (b?.annual || 0),
    m1: (a?.m1 || 0) + (b?.m1 || 0), m2: (a?.m2 || 0) + (b?.m2 || 0), m3: (a?.m3 || 0) + (b?.m3 || 0), m4: (a?.m4 || 0) + (b?.m4 || 0), 
    m5: (a?.m5 || 0) + (b?.m5 || 0), m6: (a?.m6 || 0) + (b?.m6 || 0), m7: (a?.m7 || 0) + (b?.m7 || 0), m8: (a?.m8 || 0) + (b?.m8 || 0), 
    m9: (a?.m9 || 0) + (b?.m9 || 0), m10: (a?.m10 || 0) + (b?.m10 || 0), m11: (a?.m11 || 0) + (b?.m11 || 0), m12: (a?.m12 || 0) + (b?.m12 || 0),
  })

  const subObjs = (a: any, b: any) => ({
    annual: (a?.annual || 0) - (b?.annual || 0),
    m1: (a?.m1 || 0) - (b?.m1 || 0), m2: (a?.m2 || 0) - (b?.m2 || 0), m3: (a?.m3 || 0) - (b?.m3 || 0), m4: (a?.m4 || 0) - (b?.m4 || 0), 
    m5: (a?.m5 || 0) - (b?.m5 || 0), m6: (a?.m6 || 0) - (b?.m6 || 0), m7: (a?.m7 || 0) - (b?.m7 || 0), m8: (a?.m8 || 0) - (b?.m8 || 0), 
    m9: (a?.m9 || 0) - (b?.m9 || 0), m10: (a?.m10 || 0) - (b?.m10 || 0), m11: (a?.m11 || 0) - (b?.m11 || 0), m12: (a?.m12 || 0) - (b?.m12 || 0),
  })

  const sumMulti = (...objs: any[]) => objs.reduce((acc, obj) => sumObjs(acc, obj), { annual: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0 })

  const getRowVal = (code: string) => {
    const h = heads.find(x => x.code === code)
    if (!h) return { annual: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0 }
    const b = budgetMap[h.id]
    if (!b) return { annual: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0 }
    return {
      annual: b.annualAmount || 0,
      m1: b.m1 || 0, m2: b.m2 || 0, m3: b.m3 || 0, m4: b.m4 || 0,
      m5: b.m5 || 0, m6: b.m6 || 0, m7: b.m7 || 0, m8: b.m8 || 0,
      m9: b.m9 || 0, m10: b.m10 || 0, m11: b.m11 || 0, m12: b.m12 || 0,
    }
  }

  const getChildrenSum = (parentCode: string) => {
    const p = heads.find(x => x.code === parentCode)
    if (!p) return { annual: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0 }
    const children = heads.filter(h => h.parentId === p.id)
    return children.reduce((acc, h) => sumObjs(acc, getRowVal(h.code)), { annual: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0 })
  }

  // Exact math from Excel Matrix
  const salesObj = getChildrenSum('SALES_TOTAL')
  const totalSales = salesObj.annual
  
  const purchObj = getChildrenSum('PURCH_TOTAL')
  const consumpObj = subObjs(sumMulti(getRowVal('OPEN_STOCK'), purchObj), getRowVal('CLOSE_STOCK'))
  
  const dirExpObj = getChildrenSum('DIREXP_TOTAL')
  const cogsObj = sumMulti(consumpObj, dirExpObj)
  
  const gpObj = subObjs(salesObj, cogsObj)
  
  const indIncObj = getChildrenSum('INDINC_TOTAL')
  const indExpObj = getChildrenSum('INDEXP_TOTAL')
  
  const npObj = subObjs(sumMulti(gpObj, indIncObj), indExpObj)

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
              <th style={{ color: 'var(--indigo-400)', width: 120 }}>Annual Budget</th>
              <th style={{ color: 'var(--text-secondary)', width: 80 }}>% of Rev</th>
              {MONTHS.map((m, i) => <th key={i} style={{ width: 90 }}>{m}</th>)}
              <th style={{ color: 'var(--text-secondary)', width: 80 }}>Check</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const inputStyle = {
                width: '100%', background: 'transparent', border: '1px solid transparent', borderRadius: 5, padding: '5px 8px',
                textAlign: 'right' as const, fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', outline: 'none'
              }
              const onFocusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
                e.target.style.border = '1px solid var(--indigo-500)'; e.target.style.background = 'rgba(99,102,241,0.06)'
              }
              const onBlurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
                e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'
              }

              const renderRowByCode = (code: string) => {
                const head = heads.find(h => h.code === code)
                if (!head) return null
                const isChild = !!head.parentId
                const isStock = head.code === 'OPEN_STOCK' || head.code === 'CLOSE_STOCK'
                const annual  = budgetMap[head.id]?.annualAmount ?? 0
                const mSum = [1,2,3,4,5,6,7,8,9,10,11,12].reduce((sum, m) => sum + (budgetMap[head.id]?.[`m${m}` as keyof Budget] as number ?? 0), 0)
                const check = isStock ? 0 : mSum - annual
                
                return (
                  <tr key={head.id}>
                    <td style={{
                      position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 1,
                      paddingLeft: isChild ? 28 : 14, fontSize: isChild ? '12.5px' : '13px',
                      color: isChild ? 'var(--text-secondary)' : 'var(--text-primary)',
                      display: 'flex', alignItems: 'center'
                    }}>
                      {isChild && (
                        <button 
                          className="delete-row-btn"
                          onClick={() => handleDeleteRow(head.id)}
                          title="Delete Row"
                        >
                          <span className="delete-row-icon">×</span>
                          <span className="delete-row-text">Delete</span>
                        </button>
                      )}
                      <span style={{ flex: 1 }}>
                        {isChild && !isStock ? (
                          <input type="text"
                            defaultValue={head.name}
                            onBlur={e => handleRename(head.id, e.target.value)}
                            style={{
                              background: 'transparent', border: 'none', color: 'inherit',
                              fontSize: 'inherit', width: '100%', outline: 'none'
                            }}
                          />
                        ) : (
                          head.name
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <BudgetCell className="budget-cell-input"
                        value={annual}
                        onChange={(v: string) => handleChange(head.id, v)} onBlur={() => saveRow(head.id)}
                        style={{ ...inputStyle, fontWeight: 600, color: 'var(--indigo-400)' }} onFocusCapture={onFocusStyle} onBlurCapture={onBlurStyle}
                      />
                    </td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {annual !== 0 && totalSales > 0 ? ((annual / totalSales) * 100).toFixed(1) + '%' : '—'}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const val = budgetMap[head.id]?.[`m${i+1}` as keyof Budget] as number ?? 0
                      return (
                        <td key={i} style={{ padding: '3px 4px' }}>
                          <BudgetCell className="budget-cell-input"
                            value={val}
                            onChange={(v: string) => handleMonthChange(head.id, i + 1, v)} onBlur={() => saveRow(head.id)}
                            style={inputStyle} onFocusCapture={onFocusStyle} onBlurCapture={onBlurStyle}
                          />
                        </td>
                      )
                    })}
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: Math.abs(check) > 0.01 ? 'var(--red-400)' : 'var(--text-secondary)' }}>
                      {Math.abs(check) > 0.01 ? check.toFixed(2) : '0.00'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {saving[head.id] ? (
                        <svg className="spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="14" height="14" style={{color:'var(--text-muted)'}}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/></svg>
                      ) : saved[head.id] ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="var(--green-400)" width="14" height="14"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      ) : null}
                    </td>
                  </tr>
                )
              }

              const renderSubtotalRow = (label: string, computed: any, level: 'primary' | 'secondary' | 'tertiary' = 'secondary') => {
                const annual = computed.annual
                const pct = totalSales > 0 ? (annual / totalSales * 100) : 0
                const check = [1,2,3,4,5,6,7,8,9,10,11,12].reduce((sum, m) => sum + (computed[`m${m}`] || 0), 0) - annual
                
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

                return (
                  <tr key={`subtotal-${label}`} style={{ background: bg, fontWeight: 600 }}>
                    <td style={{ position: 'sticky', left: 0, background: bg, zIndex: 1, paddingLeft: 14, color: color }}>{label}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', color: highlight, fontVariantNumeric: 'tabular-nums' }}>{annual !== 0 ? annual.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', color: subtext, fontVariantNumeric: 'tabular-nums' }}>{pct !== 0 ? pct.toFixed(1) + '%' : '—'}</td>
                    {Array.from({length: 12}).map((_, i) => (
                      <td key={i} style={{ textAlign: 'right', padding: '6px 8px', color: color, fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                        {computed[`m${i+1}`] !== 0 ? computed[`m${i+1}`].toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', padding: '6px 8px', color: Math.abs(check) > 0.01 ? (level==='primary'?'#ffb3b3':'var(--red-400)') : subtext, fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                      {Math.abs(check) > 0.01 ? check.toFixed(2) : '0.00'}
                    </td>
                    <td></td>
                  </tr>
                )
              }

              // Children mapping
              const salesChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'SALES_TOTAL')?.id).sort((a,b)=>a.sortOrder-b.sortOrder)
              const purchChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'PURCH_TOTAL')?.id).sort((a,b)=>a.sortOrder-b.sortOrder)
              const dirExpChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'DIREXP_TOTAL')?.id).sort((a,b)=>a.sortOrder-b.sortOrder)
              const indIncChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'INDINC_TOTAL')?.id).sort((a,b)=>a.sortOrder-b.sortOrder)
              const indExpChildren = heads.filter(h => h.parentId === heads.find(p => p.code === 'INDEXP_TOTAL')?.id).sort((a,b)=>a.sortOrder-b.sortOrder)

              const AddRowBtn = ({ parentCode, type }: { parentCode: string, type: string }) => (
                <tr>
                  <td colSpan={16} style={{ paddingLeft: 28, paddingBottom: 12, paddingTop: 6, borderBottom: 'none' }}>
                    <button onClick={() => handleAddRow(parentCode, type)} className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, opacity: 0.7 }}>
                      + Add Row
                    </button>
                  </td>
                </tr>
              )

              return (
                <>
                  {renderSubtotalRow('Sales Accounts', salesObj, 'secondary')}
                  {salesChildren.map(h => renderRowByCode(h.code))}
                  <AddRowBtn parentCode="SALES_TOTAL" type="REVENUE" />

                  {renderSubtotalRow('Cost of Sales', cogsObj, 'secondary')}
                  {renderRowByCode('OPEN_STOCK')}
                  {renderSubtotalRow('Add: Purchase Accounts', purchObj, 'tertiary')}
                  {purchChildren.map(h => renderRowByCode(h.code))}
                  <AddRowBtn parentCode="PURCH_TOTAL" type="COGS" />
                  
                  {renderRowByCode('CLOSE_STOCK')}
                  {renderSubtotalRow('Consumption', consumpObj, 'tertiary')}
                  
                  {renderSubtotalRow('Direct Expenses', dirExpObj, 'tertiary')}
                  {dirExpChildren.map(h => renderRowByCode(h.code))}
                  <AddRowBtn parentCode="DIREXP_TOTAL" type="DIRECT_EXPENSE" />
                  
                  {renderSubtotalRow('Gross Profit', gpObj, 'primary')}

                  {renderSubtotalRow('Indirect Incomes', indIncObj, 'secondary')}
                  {indIncChildren.map(h => renderRowByCode(h.code))}
                  <AddRowBtn parentCode="INDINC_TOTAL" type="INDIRECT_INCOME" />

                  {renderSubtotalRow('Indirect Expenses', indExpObj, 'secondary')}
                  {indExpChildren.map(h => renderRowByCode(h.code))}
                  <AddRowBtn parentCode="INDEXP_TOTAL" type="INDIRECT_EXPENSE" />

                  {renderSubtotalRow('Net Profit', npObj, 'primary')}
                </>
              )
            })()}
          </tbody>
        </table>
      </div>

      <style>{`
        .budget-cell-input:hover { border-color: rgba(99,102,241,0.3) !important; background: rgba(99,102,241,0.03) !important; }
        .budget-cell-input::placeholder { color: var(--gray-700); }
        .delete-row-btn {
          margin-right: 6px;
          margin-left: -22px;
          height: 16px;
          width: 16px;
          border-radius: 8px;
          background: transparent;
          color: var(--red-500);
          display: flex;
          align-items: center;
          font-size: 14px;
          border: none;
          cursor: pointer;
          flex-shrink: 0;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0;
          padding: 0;
          white-space: nowrap;
        }
        tr:hover .delete-row-btn {
          opacity: 0.5;
        }
        .delete-row-btn:hover {
          width: 58px;
          background: var(--red-500);
          color: white;
          opacity: 1 !important;
        }
        .delete-row-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          line-height: 1;
          margin-bottom: 2px;
        }
        .delete-row-text {
          font-size: 9px;
          font-weight: 600;
          opacity: 0;
          transition: opacity 0.2s ease;
          text-transform: uppercase;
        }
        .delete-row-btn:hover .delete-row-text {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
