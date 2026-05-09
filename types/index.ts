// User Types
export type UserRole = 'creator' | 'consumer'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
  createdAt: string
  partitionKey: string
}

export interface CreateUserInput {
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
}

// Photo Types
export type ModerationStatus = 'approved' | 'pending' | 'rejected'

export interface Photo {
  id: string
  creatorId: string
  creatorName: string
  title: string
  caption?: string
  location?: string
  people?: string[]
  imageUrl: string
  thumbnailUrl: string
  aiTags: string[]
  aiDescription?: string
  moderationStatus: ModerationStatus
  averageRating: number
  ratingCount: number
  commentCount: number
  createdAt: string
  updatedAt: string
  partitionKey: string
}

export interface CreatePhotoInput {
  title: string
  caption?: string
  location?: string
  people?: string[]
  imageUrl: string
  thumbnailUrl: string
}

export interface UpdatePhotoInput {
  title?: string
  caption?: string
  location?: string
  people?: string[]
}

// Comment Types
export interface Comment {
  id: string
  photoId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: string
  partitionKey: string
}

export interface CreateCommentInput {
  content: string
}

// Rating Types
export interface Rating {
  id: string
  photoId: string
  userId: string
  rating: number
  createdAt: string
  partitionKey: string
}

export interface CreateRatingInput {
  rating: number
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  continuationToken?: string
  hasMore: boolean
  total?: number
}

// Search Types
export interface SearchParams {
  query?: string
  tags?: string[]
  location?: string
  creatorId?: string
  sortBy?: 'date' | 'rating' | 'comments'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  continuationToken?: string
}

// AI Analysis Types
export interface ImageAnalysisResult {
  tags: string[]
  description: string
  confidence: number
}

export interface ContentModerationResult {
  isApproved: boolean
  reason?: string
  categories: {
    hate: number
    selfHarm: number
    sexual: number
    violence: number
  }
}

// Session Types
export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
  image?: string
}

// Rate Limit Types
export interface RateLimitRecord {
  id: string
  key: string
  count: number
  windowStart: number
  partitionKey: string
}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

// Audit Log Types
export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  details?: Record<string, unknown>
  ipAddress: string
  userAgent: string
  timestamp: string
  partitionKey: string
}
