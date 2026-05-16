import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// In-memory, per Edge instance. Protects public endpoints from basic abuse.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMITED_PATHS = ['/api/leads', '/api/stripe/checkout']
const RATE_LIMIT = 10   // requests
const RATE_WINDOW = 60_000 // 1 minute

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limit public POST endpoints
  if (request.method === 'POST' && RATE_LIMITED_PATHS.some(p => pathname.startsWith(p))) {
    if (!checkRateLimit(getIp(request))) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
    return NextResponse.next()
  }

  // Skip auth middleware for all other API routes
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Auth check for pages
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAdminRoute = (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/documentation') ||
    pathname.startsWith('/crm') ||
    pathname.startsWith('/campaigns') ||
    pathname.startsWith('/clients') ||
    pathname.startsWith('/calendar-sync') ||
    pathname.startsWith('/campaign-builder') ||
    pathname.startsWith('/agent')
  )
  const isClientRoute = pathname.startsWith('/client')
  const isProtected = isAdminRoute || isClientRoute
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/signup')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    const role = user.user_metadata?.role as string | undefined

    // Clients cannot access admin routes
    if (role === 'client' && isAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/client/campaigns'
      return NextResponse.redirect(url)
    }

    // Admins cannot access client routes
    if (role !== 'client' && isClientRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth pages
    if (isAuth) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'client' ? '/client/campaigns' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)', '/api/leads/:path*', '/api/stripe/checkout/:path*'],
}
