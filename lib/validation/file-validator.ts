/**
 * File upload validation utilities
 * Validates MIME types, file sizes, and performs basic security checks
 */

// Allowed image MIME types and their magic bytes
const IMAGE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF, 0xE0],
    [0xFF, 0xD8, 0xFF, 0xE1],
    [0xFF, 0xD8, 0xFF, 0xE2],
    [0xFF, 0xD8, 0xFF, 0xE3],
    [0xFF, 0xD8, 0xFF, 0xE8],
    [0xFF, 0xD8, 0xFF, 0xDB],
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF header (need to also check for WEBP)
  ],
}

// Extension to MIME type mapping
const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

// File size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MIN_FILE_SIZE = 100 // 100 bytes minimum (sanity check)

// Image dimension limits
const MAX_IMAGE_DIMENSION = 8192 // Max width or height
const MIN_IMAGE_DIMENSION = 10 // Min width or height

export interface FileValidationResult {
  isValid: boolean
  error?: string
  mimeType?: string
  extension?: string
}

export interface ImageDimensions {
  width: number
  height: number
}

/**
 * Validate file extension
 */
export function validateExtension(filename: string): FileValidationResult {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  if (!ext) {
    return { isValid: false, error: 'File has no extension' }
  }
  
  const mimeType = EXTENSION_MIME_MAP[ext]
  if (!mimeType) {
    return { isValid: false, error: `Unsupported file extension: .${ext}` }
  }
  
  return { isValid: true, mimeType, extension: ext }
}

/**
 * Validate MIME type against file signature (magic bytes)
 */
export function validateMagicBytes(buffer: ArrayBuffer | Buffer, claimedMimeType: string): FileValidationResult {
  const bytes = new Uint8Array(buffer.slice(0, 12))
  const signatures = IMAGE_SIGNATURES[claimedMimeType]
  
  if (!signatures) {
    return { isValid: false, error: `Unsupported MIME type: ${claimedMimeType}` }
  }
  
  // Special handling for WebP (RIFF....WEBP)
  if (claimedMimeType === 'image/webp') {
    const riffMatch = signatures[0].every((byte, i) => bytes[i] === byte)
    const webpMarker = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    
    if (riffMatch && webpMarker) {
      return { isValid: true, mimeType: claimedMimeType }
    }
    return { isValid: false, error: 'Invalid WebP file signature' }
  }
  
  // Check if any signature matches
  const matches = signatures.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  )
  
  if (!matches) {
    return { isValid: false, error: `File content does not match claimed MIME type: ${claimedMimeType}` }
  }
  
  return { isValid: true, mimeType: claimedMimeType }
}

/**
 * Validate file size
 */
export function validateFileSize(size: number): FileValidationResult {
  if (size < MIN_FILE_SIZE) {
    return { isValid: false, error: 'File is too small to be a valid image' }
  }
  
  if (size > MAX_FILE_SIZE) {
    return { isValid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` }
  }
  
  return { isValid: true }
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  filename: string,
  buffer: ArrayBuffer | Buffer,
  claimedMimeType: string
): FileValidationResult {
  // Validate extension
  const extResult = validateExtension(filename)
  if (!extResult.isValid) {
    return extResult
  }
  
  // Validate file size
  const sizeResult = validateFileSize(buffer.byteLength)
  if (!sizeResult.isValid) {
    return sizeResult
  }
  
  // Validate MIME type matches extension
  if (extResult.mimeType !== claimedMimeType) {
    return {
      isValid: false,
      error: `MIME type ${claimedMimeType} does not match file extension .${extResult.extension}`,
    }
  }
  
  // Validate magic bytes
  const magicResult = validateMagicBytes(buffer, claimedMimeType)
  if (!magicResult.isValid) {
    return magicResult
  }
  
  return {
    isValid: true,
    mimeType: claimedMimeType,
    extension: extResult.extension,
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return mimeToExt[mimeType] || 'jpg'
}

/**
 * Check for potential image bombs (extremely large dimensions)
 * Note: This is a basic check - actual decompression bombs need library-level protection
 */
export function validateImageDimensions(dimensions: ImageDimensions): FileValidationResult {
  if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION) {
    return { isValid: false, error: `Image dimensions too small (minimum ${MIN_IMAGE_DIMENSION}px)` }
  }
  
  if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    return { isValid: false, error: `Image dimensions too large (maximum ${MAX_IMAGE_DIMENSION}px)` }
  }
  
  // Check for extreme aspect ratios
  const aspectRatio = Math.max(dimensions.width, dimensions.height) / Math.min(dimensions.width, dimensions.height)
  if (aspectRatio > 50) {
    return { isValid: false, error: 'Image has an extreme aspect ratio' }
  }
  
  return { isValid: true }
}

/**
 * Parse image dimensions from buffer (basic implementation)
 * Note: For production, use sharp or similar library for accurate parsing
 */
export function parseImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions | null {
  try {
    const bytes = new Uint8Array(buffer)
    
    if (mimeType === 'image/png') {
      // PNG dimensions are at bytes 16-23
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
      return { width, height }
    }
    
    if (mimeType === 'image/jpeg') {
      // JPEG dimensions require parsing SOF markers - simplified approach
      let i = 2
      while (i < bytes.length - 8) {
        if (bytes[i] === 0xFF) {
          const marker = bytes[i + 1]
          // SOF0, SOF1, SOF2
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            const height = (bytes[i + 5] << 8) | bytes[i + 6]
            const width = (bytes[i + 7] << 8) | bytes[i + 8]
            return { width, height }
          }
          // Skip to next marker
          const length = (bytes[i + 2] << 8) | bytes[i + 3]
          i += 2 + length
        } else {
          i++
        }
      }
    }
    
    // For other formats, return null (would need full parsing)
    return null
  } catch {
    return null
  }
}

/**
 * Generate a secure random filename
 */
export function generateSecureFilename(extension: string): string {
  const randomBytes = new Uint8Array(16)
  crypto.getRandomValues(randomBytes)
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex}.${extension}`
}
