'use client'

import {
  ComposedChart, Bar, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from 'recharts'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtLakh(value: number) {
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000)    return `${(value / 1_00_000).toFixed(1)}L`
  return `${(value / 1000).toFixed(0)}K`
}

function fmtFull(value: number) {
  return '₹' + Math.round(value).toLocaleString('en-IN')
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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
      maxWidth: 260,
    }}>
      <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, wordBreak: 'break-word' }}>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
          <span style={{ color: entry.color }}>● {entry.name}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fmtFull(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── PLBarChart (scrollable, shows all rows) ──────────────────────────────────

type ChartDataPoint = {
  name: string
  budget: number
  actual: number
  allowed: number
  type: string
}

type Props = {
  data: ChartDataPoint[]
  height?: number
  viewLabel?: string
}

const TYPE_COLORS: Record<string, string> = {
  REVENUE:          '#6366f1',
  COGS:             '#f59e0b',
  DIRECT_EXPENSE:   '#f59e0b',
  INDIRECT_INCOME:  '#10b981',
  INDIRECT_EXPENSE: '#ef4444',
}

export function PLBarChart({ data, height = 340, viewLabel }: Props) {
  // Each data point renders as a group of bars.
  // We want ~80px per group for readability.
  const barGroupWidth = 90
  const chartWidth = Math.max(data.length * barGroupWidth, 500)

  return (
    <div>
      {viewLabel && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, marginLeft: 2 }}>
          Showing {data.length} account heads — scroll horizontally to see all
        </p>
      )}
      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'rgba(99,102,241,0.8)' }}>■ Budget</span>
        <span style={{ fontSize: 12, color: 'rgba(34,197,94,0.8)' }}>■ Actual</span>
        <span style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)' }}>■ Allowed</span>
      </div>
      {/* Scrollable wrapper */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: chartWidth, minWidth: '100%' }}>
          <ComposedChart
            width={chartWidth}
            height={height}
            data={data}
            margin={{ top: 8, right: 16, left: 4, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={72}
            />
            <YAxis
              tickFormatter={fmtLakh}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="budget" name="Budget" fill="rgba(99,102,241,0.35)" radius={[3,3,0,0]} maxBarSize={20} />
            <Bar dataKey="actual" name="Actual" fill="rgba(34,197,94,0.65)" radius={[3,3,0,0]} maxBarSize={20}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.actual >= entry.budget ? 'rgba(34,197,94,0.65)' : 'rgba(239,68,68,0.65)'} />
              ))}
            </Bar>
            <Bar dataKey="allowed" name="Allowed" fill="rgba(251,191,36,0.45)" radius={[3,3,0,0]} maxBarSize={20} />
          </ComposedChart>
        </div>
      </div>

    </div>
  )
}

// ─── VarianceBarChart ─────────────────────────────────────────────────────────

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
        <Bar dataKey="variance" name="Variance" radius={[4,4,0,0]} maxBarSize={28}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.variance >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Asset Pie Chart ──────────────────────────────────────────────────────────

const PIE_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
]

type AssetPieProps = {
  data: { category: string; count: number; wdv: number; rate: string }[]
}

const PieLabelLine = ({ cx, cy, midAngle, outerRadius, percent, name, value }: any) => {
  if (percent < 0.04) return null
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 20
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="var(--text-secondary)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {name} ({(percent * 100).toFixed(1)}%)
    </text>
  )
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border-color)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12.5,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ fontWeight: 700, color: payload[0].payload.fill || 'var(--text-primary)', marginBottom: 6 }}>{d.category}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Assets: <strong>{d.count}</strong></span>
        <span style={{ color: 'var(--text-secondary)' }}>Opening WDV: <strong>{fmtFull(d.wdv)}</strong></span>
        <span style={{ color: 'var(--text-secondary)' }}>Share: <strong>{(d.percent * 100).toFixed(1)}%</strong></span>
      </div>
    </div>
  )
}

export function AssetPieChart({ data }: AssetPieProps) {
  const total = data.reduce((s, d) => s + d.wdv, 0)
  const pieData = data.map((d, i) => ({
    ...d,
    value: d.wdv,
    percent: total > 0 ? d.wdv / total : 0,
    fill: PIE_PALETTE[i % PIE_PALETTE.length],
  }))

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Pie */}
      <div style={{ flex: '0 0 300px' }}>
        <ResponsiveContainer width={300} height={280}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={48}
              dataKey="value"
              labelLine={false}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="var(--surface-1)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Total in center via absolute pos */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: -8 }}>
          Total WDV: <strong style={{ color: 'var(--text-secondary)' }}>{fmtFull(total)}</strong>
        </p>
      </div>

      {/* Legend table */}
      <div style={{ flex: 1, minWidth: 220 }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', color: 'var(--text-muted)', padding: '4px 6px', fontWeight: 500 }}>Category</th>
              <th style={{ textAlign: 'right', color: 'var(--text-muted)', padding: '4px 6px', fontWeight: 500 }}>Assets</th>
              <th style={{ textAlign: 'right', color: 'var(--text-muted)', padding: '4px 6px', fontWeight: 500 }}>Opening WDV</th>
              <th style={{ textAlign: 'right', color: 'var(--text-muted)', padding: '4px 6px', fontWeight: 500 }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {pieData.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '5px 6px' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: d.fill, marginRight: 6, verticalAlign: 'middle' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{d.category}</span>
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>{d.count}</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {fmtFull(d.wdv)}
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: d.fill, fontWeight: 600 }}>{(d.percent * 100).toFixed(1)}%</span>
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border-color)' }}>
              <td colSpan={2} style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</td>
              <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                {fmtFull(total)}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export type MonthlyHeadDataPoint = {
  month: number
  label: string
  budget: number
  actual: number
  allowed: number
  variance: number
}

export function MonthlyComparisonChart({
  data,
  headName,
  height = 300,
}: {
  data: MonthlyHeadDataPoint[]
  headName: string
  height?: number
}) {
  return (
    <div>
      {/* Legend & Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'rgba(99,102,241,0.9)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(99,102,241,0.85)' }} /> Budget
          </span>
          <span style={{ fontSize: 12, color: 'rgba(34,197,94,0.9)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(34,197,94,0.85)' }} /> Actual
          </span>
          <span style={{ fontSize: 12, color: 'rgba(251,191,36,0.9)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(251,191,36,0.85)' }} /> Allowed
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          12 Months (Apr–Mar) Comparison for <strong>{headName}</strong>
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={11}
              tickFormatter={fmtLakh}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
              width={54}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="budget" name="Budget" fill="rgba(99,102,241,0.8)" radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Bar dataKey="actual" name="Actual" fill="rgba(34,197,94,0.8)" radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Bar dataKey="allowed" name="Allowed" fill="rgba(251,191,36,0.8)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
