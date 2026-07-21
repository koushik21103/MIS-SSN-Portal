'use client'

import { useState, useEffect } from 'react'

type User = { id: string; name: string; email: string; role: string; createdAt: string }

const ROLE_OPTIONS = ['ADMIN', 'FINANCE', 'CFO', 'VIEWER']
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'role-admin', FINANCE: 'role-finance', CFO: 'role-cfo', VIEWER: 'role-viewer',
}

export default function UsersPage() {
  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser]   = useState<User | null>(null)
  const [form, setForm]           = useState({ name: '', email: '', password: '', role: 'FINANCE' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function fetchUsers() {
    const res  = await fetch(`/api/users?t=${Date.now()}`, { cache: 'no-store' })
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  function openCreate() {
    setEditUser(null)
    setForm({ name: '', email: '', password: '', role: 'FINANCE' })
    setError('')
    setShowModal(true)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (editUser) {
      // Update role/name only
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUser.id, name: form.name, role: form.role }),
      })
      if (res.ok) {
        setShowModal(false)
        fetchUsers()
      } else {
        const d = await res.json()
        setError(d.error ?? 'Failed to update')
      }
    } else {
      // Create new user
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowModal(false)
        fetchUsers()
      } else {
        const d = await res.json()
        setError(d.error ?? 'Failed to create')
      }
    }
    setSaving(false)
  }

  async function handleDelete(u: User) {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    })
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to delete user. They may be linked to financial records.')
    }
    
    fetchUsers()
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Admin · Manage portal users and access roles</p>
        </div>
        <button id="users-add-btn" className="btn btn-primary" onClick={openCreate}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          Add User
        </button>
      </div>

      {loading ? (
        <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>
      ) : (
        <div className="table-wrapper">
          <table className="mis-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 180 }}>Name</th>
                <th style={{ textAlign: 'left', minWidth: 220 }}>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className={`role-badge ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button id={`user-edit-${u.email.replace('@','_')}`}
                        className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => openEdit(u)}>
                        Edit
                      </button>
                      <button id={`user-del-${u.email.replace('@','_')}`}
                        className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => handleDelete(u)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Role permissions reference */}
      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Role Permissions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { role: 'ADMIN', label: 'Admin', perms: ['All pages', 'Budget entry', 'User management', 'Period lock/unlock'] },
            { role: 'FINANCE', label: 'Finance', perms: ['Dashboard', 'Actuals entry (open periods only)', 'No budget or reports'] },
            { role: 'CFO', label: 'CFO', perms: ['Dashboard', 'MIS P&L', 'Variance', 'Depreciation', 'Reports'] },
            { role: 'VIEWER', label: 'Viewer', perms: ['Dashboard', 'MIS P&L', 'Reports (read-only)'] },
          ].map(({ role, label, perms }) => (
            <div key={role} style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
              <div className={`role-badge ${ROLE_COLORS[role]}`} style={{ marginBottom: 10 }}>{label}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {perms.map(p => (
                  <li key={p} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--green-400)', flexShrink: 0 }}>✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-primary)' }}>
              {editUser ? 'Edit User' : 'Add New User'}
            </h2>

            {error && (
              <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>
            )}

            <form id="user-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input id="user-form-name" className="input" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Priya Sharma" required />
              </div>

              {!editUser && (
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input id="user-form-email" className="input" type="email" value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="priya@company.com" required />
                </div>
              )}

              {!editUser && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input id="user-form-password" className="input" type="password" value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min 8 characters" required minLength={8} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Role</label>
                <select id="user-form-role" className="select" value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" id="user-form-submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Saving…' : editUser ? 'Update User' : 'Create User'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
