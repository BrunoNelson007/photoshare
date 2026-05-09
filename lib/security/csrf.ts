import { cookies } from 'next/headers'

const CSRF_COOKIE_NAME = '__Host-csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_LENGTH = 32

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Set CSRF cookie with secure options
 */
export async function setCsrfCookie(): Promise<string> {
  const token = generateCsrfToken()
  const cookieStore = await cookies()
  
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })
  
  return token
}

/**
 * Get CSRF token from cookie
 */
export async function getCsrfTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_COOKIE_NAME)?.value || null
}

/**
 * Validate CSRF token from request
 * Uses double-submit cookie pattern
 */
export async function validateCsrfToken(request: Request): Promise<{
  valid: boolean
  error?: string
}> {
  // Skip CSRF for GET, HEAD, OPTIONS
  const method = request.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true }
  }
  
  // Get token from cookie
  const cookieToken = await getCsrfTokenFromCookie()
  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF cookie' }
  }
  
  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!headerToken) {
    return { valid: false, error: 'Missing CSRF header' }
  }
  
  // Compare tokens (timing-safe comparison)
  if (!timingSafeEqual(cookieToken, headerToken)) {
    return { valid: false, error: 'CSRF token mismatch' }
  }
  
  return { valid: true }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * CSRF token response for client-side storage
 */
export interface CsrfTokenResponse {
  token: string
}

/**
 * Get or create CSRF token for client
 */
export async function getOrCreateCsrfToken(): Promise<string> {
  const existing = await getCsrfTokenFromCookie()
  if (existing) {
    return existing
  }
  return setCsrfCookie()
}

/**
 * Create CSRF protection middleware response
 */
export function csrfErrorResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'CSRF validation failed' }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * React hook helper - returns headers needed for CSRF
 */
export function getCsrfHeaders(token: string): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: token,
  }
}
