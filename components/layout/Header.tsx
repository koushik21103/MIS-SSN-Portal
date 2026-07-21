'use client'

import { signOut } from 'next-auth/react'
import type { Role } from '@prisma/client'
import { useFY } from '@/components/FYProvider'

const MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

export default function Header({
  user,
}: {
  user: { name?: string | null; email?: string | null; role: Role }
}) {
  // Current month indicator (April = 1)
  const now = new Date()
  const fiscalMonth = now.getMonth() >= 3 ? now.getMonth() - 3 : now.getMonth() + 9
  const monthLabel = MONTH_NAMES[fiscalMonth]
  const { fyId, setFyId, availableFys, loading } = useFY()

  return (
    <header className="dashboard-header" id="dashboard-header">
      {/* Left: Page context */}
      <div className="header-left">
        <div className="header-period" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="period-dot" />
          <span className="period-label">Active month: <strong>{monthLabel}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          {loading ? (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading FY...</span>
          ) : (
            <select 
              className="input" 
              style={{ padding: '2px 28px 2px 8px', height: 28, fontSize: 12.5, width: 'auto', minWidth: 140 }}
              value={fyId}
              onChange={e => setFyId(e.target.value)}
            >
              {availableFys.map(f => (
                <option key={f.id} value={f.id}>{f.label} {f.isActive ? '(Active)' : ''}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Right: User + actions */}
      <div className="header-right">
        {/* Notification bell placeholder */}
        <button className="header-icon-btn" aria-label="Notifications" id="header-notifications-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>

        {/* User avatar + name */}
        <div className="header-user" id="header-user-menu">
          <div className="user-avatar">
            {user.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>

          {/* Sign out */}
          <button
            id="header-signout-btn"
            className="header-icon-btn signout-btn"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
