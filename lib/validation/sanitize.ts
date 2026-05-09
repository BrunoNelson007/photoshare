import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize plain text - removes HTML tags and dangerous characters
 */
export function sanitizeText(input: string): string {
  if (!input) return ''
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '')
  
  // Decode HTML entities
  sanitized = decodeHTMLEntities(sanitized)
  
  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()
  
  return sanitized
}

/**
 * Sanitize HTML content - allows safe HTML tags but removes dangerous ones
 * Used for rich text content like comments
 */
export function sanitizeHtml(input: string): string {
  if (!input) return ''
  
  // Configure DOMPurify to allow only safe tags
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  })
  
  // Additional cleanup
  return clean.trim()
}

/**
 * Sanitize for use in URLs/paths - prevents path traversal
 */
export function sanitizePathComponent(input: string): string {
  if (!input) return ''
  
  // Remove path traversal sequences
  let sanitized = input.replace(/\.\./g, '')
  sanitized = sanitized.replace(/\//g, '')
  sanitized = sanitized.replace(/\\/g, '')
  
  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '')
  
  // Only allow alphanumeric, dash, underscore, and dot
  sanitized = sanitized.replace(/[^a-zA-Z0-9_\-\.]/g, '')
  
  return sanitized
}

/**
 * Sanitize filename - ensures safe filename for storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed'
  
  // Get extension and name separately
  const lastDot = filename.lastIndexOf('.')
  const name = lastDot > 0 ? filename.slice(0, lastDot) : filename
  const ext = lastDot > 0 ? filename.slice(lastDot + 1) : ''
  
  // Sanitize name
  let sanitizedName = name
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100)
  
  if (!sanitizedName) {
    sanitizedName = 'unnamed'
  }
  
  // Sanitize extension
  const sanitizedExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)
  
  return sanitizedExt ? `${sanitizedName}.${sanitizedExt}` : sanitizedName
}

/**
 * Sanitize email - basic validation and normalization
 */
export function sanitizeEmail(email: string): string {
  if (!email) return ''
  
  return email.toLowerCase().trim()
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  }
  
  return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity)
}

/**
 * Escape string for safe inclusion in JSON
 */
export function escapeForJson(input: string): string {
  return JSON.stringify(input).slice(1, -1)
}

/**
 * Strip EXIF and other metadata from image (conceptual - actual implementation needs sharp)
 * Note: For production, use a library like sharp to strip metadata
 */
export function getCleanImageMimeType(mimeType: string): string {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  return allowedTypes.includes(mimeType) ? mimeType : 'application/octet-stream'
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null
  
  try {
    const parsed = new URL(url)
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    
    // Don't allow javascript: URLs disguised with special characters
    if (parsed.href.toLowerCase().includes('javascript:')) {
      return null
    }
    
    return parsed.href
  } catch {
    return null
  }
}

/**
 * Validate image URL specifically
 */
export function validateImageUrl(url: string): boolean {
  const sanitized = sanitizeUrl(url)
  if (!sanitized) return false
  
  // Check for common image extensions or Azure Blob URLs
  const imagePatterns = [
    /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i,
    /blob\.core\.windows\.net/i,
    /\.blob\.core\.windows\.net/i,
  ]
  
  return imagePatterns.some((pattern) => pattern.test(sanitized))
}

/**
 * Remove potential SQL/NoSQL injection patterns
 * Note: Always use parameterized queries - this is defense in depth
 */
export function sanitizeForDatabase(input: string): string {
  if (!input) return ''
  
  // Remove common injection patterns
  let sanitized = input
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comment start
    .replace(/\*\//g, '') // Remove block comment end
    .replace(/\$/g, '') // Remove MongoDB operators prefix
    .replace(/\{/g, '') // Remove JSON start
    .replace(/\}/g, '') // Remove JSON end
  
  return sanitized.trim()
}
