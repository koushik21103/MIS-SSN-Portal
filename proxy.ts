import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Public routes — no auth needed
const PUBLIC_ROUTES = ['/login', '/api/auth']

// Route prefix that requires login
const PROTECTED_PREFIX = '/dashboard'

// Role-based allowed path prefixes
const ROLE_ROUTES: Record<string, string[]> = {
  ADMIN:   ['/dashboard'],
  FINANCE: ['/dashboard/actuals', '/dashboard'],
  CFO:     ['/dashboard/mis', '/dashboard/variance', '/dashboard/depreciation', '/dashboard/reports', '/dashboard'],
  VIEWER:  ['/dashboard/mis', '/dashboard/reports', '/dashboard'],
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public routes
  if (PUBLIC_ROUTES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // For protected routes, check JWT
  if (pathname.startsWith(PROTECTED_PREFIX)) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET!,
      secureCookie: process.env.NODE_ENV === 'production',
    })

    // Not logged in → redirect to login
    if (!token) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const role = (token.role as string) ?? ''

    // ADMIN can access everything
    if (role === 'ADMIN') return NextResponse.next()

    // Check role-based allowed paths
    const allowed = ROLE_ROUTES[role] ?? []
    const isAllowed = allowed.some(prefix => pathname.startsWith(prefix))
    if (!isAllowed) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
