'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

type ChartDataPoint = {
  month:   string
  budget:  number
  actual:  number
  allowed: number
}

type Props = {
  data:   ChartDataPoint[]
  height?: number
}

function fmtLakh(value: number) {
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000)    return `${(value / 1_00_000).toFixed(1)}L`
  return `${(value / 1000).toFixed(0)}K`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12.5,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
          <span style={{ color: entry.color }}>● {entry.name}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            ₹{entry.value.toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PLBarChart({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--text-muted)', fontSize: 11.5 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tickFormatter={fmtLakh}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false} tickLine={false} width={42}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
        />
        <Bar dataKey="budget"  name="Budget"  fill="rgba(99,102,241,0.35)" radius={[4,4,0,0]} maxBarSize={22} />
        <Bar dataKey="actual"  name="Actual"  fill="rgba(34,197,94,0.6)"   radius={[4,4,0,0]} maxBarSize={22} />
        <Line dataKey="allowed" name="Allowed" stroke="#fbbf24" strokeWidth={2} dot={false} strokeDasharray="4 3" type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

type VarianceChartProps = {
  data: { month: string; variance: number }[]
  height?: number
}

export function VarianceBarChart({ data, height = 220 }: VarianceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11.5 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtLakh} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar
          dataKey="variance"
          name="Variance"
          radius={[4,4,0,0]}
          maxBarSize={28}
          fill="#6366f1"
          // Color individual bars based on value
          // recharts doesn't support per-bar fill via props — use Cell
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
