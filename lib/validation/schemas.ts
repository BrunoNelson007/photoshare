import { z } from 'zod'
import { sanitizeText, sanitizeHtml } from './sanitize'

// Custom transformers that sanitize input
const sanitizedString = (maxLength: number) =>
  z.string().max(maxLength).transform(sanitizeText)

const sanitizedHtmlString = (maxLength: number) =>
  z.string().max(maxLength).transform(sanitizeHtml)

// Photo schemas
export const photoUploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less').transform(sanitizeText),
  caption: z.string().max(500, 'Caption must be 500 characters or less').transform(sanitizeText).optional(),
  location: z.string().max(100, 'Location must be 100 characters or less').transform(sanitizeText).optional(),
  people: z.array(
    z.string().max(50).transform(sanitizeText)
  ).max(10, 'Maximum 10 people tags allowed').optional(),
})

export const photoUpdateSchema = z.object({
  title: sanitizedString(100).optional(),
  caption: sanitizedString(500).optional(),
  location: sanitizedString(100).optional(),
  people: z.array(sanitizedString(50)).max(10).optional(),
})

// Comment schemas
export const commentSchema = z.object({
  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment must be 1000 characters or less')
    .transform(sanitizeHtml),
})

// Rating schemas
export const ratingSchema = z.object({
  rating: z.number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
})

// Search schemas
export const searchSchema = z.object({
  query: sanitizedString(200).optional(),
  tags: z.array(sanitizedString(50)).max(10).optional(),
  location: sanitizedString(100).optional(),
  creatorId: z.string().uuid().optional(),
  sortBy: z.enum(['date', 'rating', 'comments']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  continuationToken: z.string().optional(),
})

// User schemas
export const userUpdateSchema = z.object({
  name: sanitizedString(100).optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
})

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  name: sanitizedString(100),
  role: z.enum(['creator', 'consumer']).optional().default('consumer'),
})

// File validation schema
export const fileUploadSchema = z.object({
  fileName: z.string()
    .max(255)
    .regex(/^[a-zA-Z0-9_\-. ]+$/, 'Invalid file name characters'),
  fileSize: z.number()
    .int()
    .min(1, 'File cannot be empty')
    .max(10 * 1024 * 1024, 'File must be less than 10MB'),
  mimeType: z.enum([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ], { errorMap: () => ({ message: 'Only JPEG, PNG, GIF, and WebP images are allowed' }) }),
})

// ID validation
export const idSchema = z.string().uuid('Invalid ID format')

// Pagination schema
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  continuationToken: z.string().optional(),
})

// Helper function to validate and parse input
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true
  data: T
} | {
  success: false
  errors: z.ZodError['errors']
} {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, errors: result.error.errors }
}

// Format validation errors for API response
export function formatValidationErrors(errors: z.ZodError['errors']): string {
  return errors
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join(', ')
}

// Type exports
export type PhotoUploadInput = z.infer<typeof photoUploadSchema>
export type PhotoUpdateInput = z.infer<typeof photoUpdateSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type RatingInput = z.infer<typeof ratingSchema>
export type SearchInput = z.infer<typeof searchSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type FileUploadInput = z.infer<typeof fileUploadSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
