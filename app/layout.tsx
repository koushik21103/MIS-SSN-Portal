import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s — MIS Portal',
    default:  'MIS Portal',
  },
  description: 'Management Information System — Budget, Actuals, P&L, Variance & Depreciation',
  keywords: ['MIS', 'P&L', 'Budget', 'Actuals', 'Variance', 'Depreciation'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-inter, Inter, system-ui, sans-serif)' }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
