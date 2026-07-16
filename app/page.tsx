import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

// Root "/" redirects to dashboard (if logged in) or login
export default async function HomePage() {
  const session = await auth()
  if (session) redirect('/dashboard')
  redirect('/login')
}
