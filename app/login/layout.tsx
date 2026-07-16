import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — MIS Portal',
  description: 'Sign in to the Management Information System',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
