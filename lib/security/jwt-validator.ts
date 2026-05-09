import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose'
import type { SessionUser, UserRole } from '@/types'

// JWKS cache for Auth0
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null
let jwksCacheExpiry = 0
const JWKS_CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Get or create cached JWKS for Auth0
 */
function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL
  
  if (!issuer) {
    throw new Error('Missing AUTH0_ISSUER_BASE_URL environment variable')
  }
  
  const now = Date.now()
  
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache
  }
  
  // Auth0 JWKS endpoint
  const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`)
  
  jwksCache = createRemoteJWKSet(jwksUrl)
  jwksCacheExpiry = now + JWKS_CACHE_TTL
  
  return jwksCache
}

export interface JWTValidationResult {
  valid: boolean
  payload?: JWTPayload & {
    sub?: string
    email?: string
    name?: string
    role?: UserRole
    nickname?: string
    picture?: string
    'https://photoshare.app/roles'?: string[]
  }
  error?: string
}

/**
 * Validate a JWT token from Auth0
 */
export async function validateJWT(token: string): Promise<JWTValidationResult> {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL
  const audience = process.env.AUTH0_AUDIENCE || process.env.AUTH0_CLIENT_ID
  
  if (!issuer) {
    return { valid: false, error: 'Missing Auth0 configuration' }
  }
  
  try {
    const JWKS = getJWKS()
    
    const verifyOptions: Parameters<typeof jwtVerify>[2] = {
      issuer: issuer.endsWith('/') ? issuer : `${issuer}/`,
    }
    
    // Only verify audience if configured
    if (audience) {
      verifyOptions.audience = audience
    }
    
    const { payload } = await jwtVerify(token, JWKS, verifyOptions)
    
    return {
      valid: true,
      payload: payload as JWTValidationResult['payload'],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('exp')) {
      return { valid: false, error: 'Token has expired' }
    }
    if (errorMessage.includes('iss')) {
      return { valid: false, error: 'Invalid token issuer' }
    }
    if (errorMessage.includes('aud')) {
      return { valid: false, error: 'Invalid token audience' }
    }
    if (errorMessage.includes('signature')) {
      return { valid: false, error: 'Invalid token signature' }
    }
    
    return { valid: false, error: `Token validation failed: ${errorMessage}` }
  }
}

/**
 * Extract user info from validated JWT payload
 */
export function extractUserFromJWT(payload: NonNullable<JWTValidationResult['payload']>): SessionUser {
  const email = payload.email || ''
  
  // Check for custom role claim (Auth0 Actions/Rules can add this)
  const customRoles = payload['https://photoshare.app/roles'] || []
  const role: UserRole = customRoles.includes('creator') ? 'creator' : 'consumer'
  
  return {
    id: payload.sub || '',
    email,
    name: payload.name || payload.nickname || email.split('@')[0] || 'User',
    role,
    image: payload.picture,
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null
  }
  
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null
  }
  
  return parts[1]
}

/**
 * Check if user has required role
 */
export function hasRole(user: SessionUser, requiredRole: UserRole): boolean {
  if (user.role === 'creator') {
    return true
  }
  
  return user.role === requiredRole
}

/**
 * Check if user can perform action on resource
 */
export function canAccess(
  user: SessionUser,
  action: 'read' | 'write' | 'delete',
  resourceOwnerId?: string
): boolean {
  if (user.role === 'creator') {
    if (action === 'read') return true
    return resourceOwnerId === user.id
  }
  
  if (user.role === 'consumer') {
    if (action === 'read') return true
    if (action === 'write') return true
    return false
  }
  
  return false
}

/**
 * Validate that a request is authenticated and authorized
 */
export async function validateRequest(
  request: Request,
  requiredRole?: UserRole
): Promise<{
  authenticated: boolean
  user?: SessionUser
  error?: string
}> {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)
  
  if (!token) {
    return { authenticated: false, error: 'No authentication token provided' }
  }
  
  const result = await validateJWT(token)
  
  if (!result.valid || !result.payload) {
    return { authenticated: false, error: result.error || 'Invalid token' }
  }
  
  const user = extractUserFromJWT(result.payload)
  
  if (requiredRole && !hasRole(user, requiredRole)) {
    return {
      authenticated: true,
      user,
      error: `Insufficient permissions. Required role: ${requiredRole}`,
    }
  }
  
  return { authenticated: true, user }
}
