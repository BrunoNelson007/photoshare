import { getRateLimitRecord, upsertRateLimitRecord } from '@/lib/azure-cosmos'
import type { RateLimitRecord, RateLimitConfig } from '@/types'

// In-memory cache for development and edge cases
const memoryCache = new Map<string, { count: number; windowStart: number }>()

// Default rate limit configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints - strict limits
  'auth:login': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute
  'auth:register': { windowMs: 60 * 1000, maxRequests: 3 }, // 3 per minute
  
  // Photo operations
  'photo:upload': { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 per hour
  'photo:delete': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  
  // Comments
  'comment:create': { windowMs: 60 * 1000, maxRequests: 20 }, // 20 per minute
  
  // Ratings
  'rating:create': { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute
  
  // Search
  'search': { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute
  
  // General API
  'api:general': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 per minute
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfter?: number
}

/**
 * Check rate limit using sliding window algorithm
 * Uses Cosmos DB for distributed rate limiting in production
 */
export async function checkRateLimit(
  key: string,
  action: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const rateLimitConfig = config || RATE_LIMITS[action] || RATE_LIMITS['api:general']
  const { windowMs, maxRequests } = rateLimitConfig
  
  const now = Date.now()
  const windowStart = now - windowMs
  const recordKey = `${action}:${key}`
  
  try {
    // Try to use Cosmos DB for distributed rate limiting
    const record = await getRateLimitRecord(recordKey)
    
    let count = 0
    let recordWindowStart = now
    
    if (record && record.windowStart > windowStart) {
      // Record is within current window
      count = record.count
      recordWindowStart = record.windowStart
    }
    
    // Check if limit exceeded
    if (count >= maxRequests) {
      const resetAt = new Date(recordWindowStart + windowMs)
      const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000)
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      }
    }
    
    // Increment counter
    const newRecord: RateLimitRecord = {
      id: recordKey,
      key: recordKey,
      count: count + 1,
      windowStart: count === 0 ? now : recordWindowStart,
      partitionKey: recordKey,
    }
    
    await upsertRateLimitRecord(newRecord)
    
    return {
      allowed: true,
      remaining: maxRequests - count - 1,
      resetAt: new Date(newRecord.windowStart + windowMs),
    }
  } catch (error) {
    // Fallback to memory cache if Cosmos DB fails
    console.warn('Rate limit Cosmos DB failed, using memory cache:', error)
    return checkRateLimitMemory(recordKey, windowMs, maxRequests, now)
  }
}

/**
 * In-memory rate limit check (fallback/development)
 */
function checkRateLimitMemory(
  key: string,
  windowMs: number,
  maxRequests: number,
  now: number
): RateLimitResult {
  const cached = memoryCache.get(key)
  const windowStart = now - windowMs
  
  let count = 0
  let recordWindowStart = now
  
  if (cached && cached.windowStart > windowStart) {
    count = cached.count
    recordWindowStart = cached.windowStart
  }
  
  if (count >= maxRequests) {
    const resetAt = new Date(recordWindowStart + windowMs)
    const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000)
    
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    }
  }
  
  memoryCache.set(key, {
    count: count + 1,
    windowStart: count === 0 ? now : recordWindowStart,
  })
  
  return {
    allowed: true,
    remaining: maxRequests - count - 1,
    resetAt: new Date((count === 0 ? now : recordWindowStart) + windowMs),
  }
}

/**
 * Clean up expired entries from memory cache
 * Should be called periodically
 */
export function cleanupMemoryCache(): void {
  const now = Date.now()
  const maxAge = 60 * 60 * 1000 // 1 hour
  
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.windowStart > maxAge) {
      memoryCache.delete(key)
    }
  }
}

/**
 * Get rate limit key from request
 */
export function getRateLimitKey(
  identifier: string,
  type: 'ip' | 'user' = 'ip'
): string {
  return `${type}:${identifier}`
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Azure-specific header
  const clientIp = request.headers.get('x-client-ip')
  if (clientIp) {
    return clientIp
  }
  
  // Fallback
  return 'unknown'
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
  }
  
  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString()
  }
  
  return headers
}
