import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/upload',
  '/photos',
  '/api/photos',
  '/api/comments',
  '/api/ratings',
]

// Routes that require creator role
const CREATOR_ROUTES = [
  '/dashboard',
  '/upload',
  '/photos',
]

// Public routes (no auth required)
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/search',
  '/photo',
  '/api/search',
  '/api/auth',
  '/api/csrf',
]

// API routes that need rate limiting
const RATE_LIMITED_ROUTES = [
  '/api/photos',
  '/api/comments',
  '/api/ratings',
  '/api/search',
  '/api/auth',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()
  
  // Add request ID for tracking
  const requestId = crypto.randomUUID()
  response.headers.set('x-request-id', requestId)
  
  // CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      process.env.NEXTAUTH_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean)
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token')
    }
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers })
    }
  }
  
  // Check if route needs authentication
  const needsAuth = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  const needsCreator = CREATOR_ROUTES.some((route) => pathname.startsWith(route))
  const isPublic = PUBLIC_ROUTES.some((route) => 
    pathname === route || pathname.startsWith(route + '/')
  )
  
  // Skip auth check for public routes and static files
  if (isPublic || pathname.startsWith('/_next') || pathname.includes('.')) {
    return response
  }
  
  // For protected routes, check for session
  if (needsAuth) {
    const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                        request.cookies.get('__Secure-next-auth.session-token')?.value
    
    if (!sessionToken) {
      // Redirect to login for page routes
      if (!pathname.startsWith('/api/')) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
      }
      
      // Return 401 for API routes
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Note: Role validation happens in the API routes/pages themselves
    // as we need to decode the session which is better done in server components
  }
  
  // Add rate limit headers placeholder
  // Actual rate limiting is done in API route handlers for more granular control
  if (RATE_LIMITED_ROUTES.some((route) => pathname.startsWith(route))) {
    // Rate limiting headers will be added by the route handlers
    response.headers.set('x-rate-limit-enabled', 'true')
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
