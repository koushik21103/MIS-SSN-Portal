import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { FYProvider } from '@/components/FYProvider'

export const metadata: Metadata = {
  title: 'MIS Portal',
  description: 'Management Information System — Budget, Actuals, P&L, Variance Analysis',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="dashboard-layout">
      <FYProvider>
        <Sidebar role={session.user.role} />
        <div className="dashboard-main">
          <Header user={session.user} />
          <main className="dashboard-content">
            {children}
          </main>
        </div>
      </FYProvider>
    </div>
  )
}
