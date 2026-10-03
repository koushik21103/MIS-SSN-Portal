'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Role } from '@prisma/client'

type NavItem = {
  href:    string
  label:   string
  icon:    React.ReactNode
  roles:   Role[]
  badge?:  string
}

const NAV_ITEMS: NavItem[] = [
  {
    href:  '/dashboard',
    label: 'Overview',
    roles: ['ADMIN', 'FINANCE', 'CFO', 'VIEWER'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/budget',
    label: 'Budget',
    roles: ['ADMIN'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/actuals',
    label: 'Actuals Entry',
    roles: ['ADMIN', 'FINANCE'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/mis',
    label: 'MIS P&L',
    roles: ['ADMIN', 'CFO', 'VIEWER'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/variance',
    label: 'Variance',
    roles: ['ADMIN', 'CFO'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/depreciation',
    label: 'Depreciation',
    roles: ['ADMIN', 'CFO'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/reports',
    label: 'Reports',
    roles: ['ADMIN', 'CFO', 'VIEWER'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/assets',
    label: 'Assets',
    roles: ['ADMIN', 'FINANCE', 'CFO'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/users',
    label: 'Users',
    roles: ['ADMIN'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href:  '/dashboard/settings',
    label: 'Settings',
    roles: ['ADMIN'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

const ROLE_LABELS: Record<Role, string> = {
  ADMIN:   'Administrator',
  FINANCE: 'Finance',
  CFO:     'CFO',
  VIEWER:  'Viewer',
}

const COLLAPSED_WIDTH = '60px'
const EXPANDED_WIDTH = '240px'

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Persist collapse state in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed(c => {
      localStorage.setItem('sidebar-collapsed', String(!c))
      return !c
    })
  }

  // Notify main content to shift
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
    )
  }, [collapsed])

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))

  return (
    <aside
      className="sidebar"
      id="main-sidebar"
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)' }}
    >
      {/* Brand + toggle */}
      <div
        className="sidebar-brand"
        style={{
          padding: collapsed ? '14px 0 10px' : '20px 16px 18px',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: collapsed ? 6 : 10,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <div
          className="sidebar-logo"
          style={{ flexShrink: 0, cursor: collapsed ? 'pointer' : 'default', display: 'flex', justifyContent: 'center' }}
          onClick={collapsed ? toggle : undefined}
          title={collapsed ? 'Click to expand sidebar' : undefined}
        >
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
            <rect width="40" height="40" rx="10" fill="url(#sbgrad)"/>
            <path d="M10 28V14l10 7 10-7v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="sbgrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <span className="sidebar-brand-name">MIS Portal</span>
            <span className="sidebar-fy">FY 2026–2027</span>
          </div>
        )}
        {/* Collapse toggle button */}
        <button
          id="sidebar-toggle"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            flexShrink: 0,
            marginLeft: collapsed ? 0 : 'auto',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {collapsed ? (
            // Chevron right (expand)
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          ) : (
            // Chevron left (collapse)
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" aria-label="Main navigation" style={{ padding: collapsed ? '12px 4px' : '12px 8px' }}>
        {visibleItems.map(item => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
              className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              style={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '9px 0' : '9px 12px',
              }}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {!collapsed && (
                <span className="sidebar-link-label">{item.label}</span>
              )}
              {!collapsed && item.badge && <span className="sidebar-badge">{item.badge}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Role badge at bottom */}
      <div className="sidebar-footer" style={{ padding: collapsed ? '12px 0' : '16px', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        {collapsed ? (
          <div title={ROLE_LABELS[role]} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em', fontWeight: 600 }}>
            {role.slice(0, 2)}
          </div>
        ) : (
          <span className={`role-badge role-${role.toLowerCase()}`}>
            {ROLE_LABELS[role]}
          </span>
        )}
      </div>
    </aside>
  )
}
