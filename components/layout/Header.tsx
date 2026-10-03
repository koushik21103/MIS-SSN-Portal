'use client'

import { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import type { Role } from '@prisma/client'
import { useFY } from '@/components/FYProvider'

const MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

type Notification = {
  id: string
  title: string
  message: string
  type: 'action' | 'info' | 'warning' | 'success'
  timestamp: string
  link?: string
  actionable?: boolean
  requestId?: string
}

export default function Header({
  user,
}: {
  user: { name?: string | null; email?: string | null; role: Role }
}) {
  const now = new Date()
  const fiscalMonth = now.getMonth() >= 3 ? now.getMonth() - 3 : now.getMonth() + 9
  const monthLabel = MONTH_NAMES[fiscalMonth]
  const { fyId, setFyId, availableFys, loading } = useFY()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications${fyId ? `?fyId=${fyId}` : ''}`)
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 30000)
    return () => clearInterval(timer)
  }, [fyId])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const handleDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActingId(requestId)
    try {
      const res = await fetch('/api/assets/edit-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision }),
      })
      if (res.ok) {
        await fetchNotifications()
      }
    } finally {
      setActingId(null)
    }
  }

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
      <div className="header-right" style={{ position: 'relative' }}>
        {/* Notification bell */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            className="header-icon-btn"
            aria-label="Notifications"
            id="header-notifications-btn"
            onClick={() => setShowDropdown(prev => !prev)}
            style={{ position: 'relative' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  background: 'var(--red-400)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  boxShadow: '0 0 6px rgba(239,68,68,0.6)',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 340,
                background: 'var(--surface-1)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
                zIndex: 1000,
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              {/* Header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Notifications &amp; Alerts
                </span>
                {unreadCount > 0 && (
                  <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.15)', color: 'var(--red-400)', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                    {unreadCount} Action{unreadCount > 1 ? 's' : ''} Required
                  </span>
                )}
              </div>

              {/* Items List */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                    ✓ All caught up! No pending alerts.
                  </div>
                ) : (
                  notifications.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: item.type === 'action' ? 'rgba(99,102,241,0.04)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: item.type === 'action' ? 'var(--indigo-400)' : item.type === 'success' ? 'var(--green-400)' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}>
                          {item.type === 'action' && '🔔'}
                          {item.type === 'info' && 'ℹ️'}
                          {item.type === 'success' && '✓'}
                          {item.title}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>
                        {item.message}
                      </p>

                      {/* Action buttons if actionable */}
                      {item.actionable && item.requestId && (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '3px 10px', height: 24 }}
                            disabled={actingId === item.requestId}
                            onClick={() => handleDecision(item.requestId!, 'APPROVED')}
                          >
                            {actingId === item.requestId ? '...' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '3px 10px', height: 24, color: 'var(--red-400)' }}
                            disabled={actingId === item.requestId}
                            onClick={() => handleDecision(item.requestId!, 'REJECTED')}
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Quick link navigation */}
                      {item.link && (
                        <div style={{ marginTop: 4 }}>
                          <Link
                            href={item.link}
                            onClick={() => setShowDropdown(false)}
                            style={{ fontSize: 11, color: 'var(--indigo-400)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            Go to {item.link.replace('/dashboard/', '').toUpperCase()} →
                          </Link>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
