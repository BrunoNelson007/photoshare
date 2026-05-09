import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  getPhotoByIdCrossPartition, 
  createComment, 
  getCommentsByPhoto,
  updatePhotoStats 
} from '@/lib/azure-cosmos'
import { moderateText } from '@/lib/azure-content-safety'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/security/rate-limiter'
import { commentSchema, validateInput, formatValidationErrors } from '@/lib/validation/schemas'
import type { Comment } from '@/types'
import { v4 as uuidv4 } from 'uuid'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const continuationToken = searchParams.get('token') || undefined
    
    const photo = await getPhotoByIdCrossPartition(id)
    
    if (!photo || photo.moderationStatus !== 'approved') {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    const result = await getCommentsByPhoto(id, limit, continuationToken)
    
    return NextResponse.json({
      items: result.items,
      continuationToken: result.continuationToken,
      hasMore: result.hasMore,
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Rate limiting
    const rateLimit = await checkRateLimit(session.user.id, 'comment:create')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      )
    }
    
    const { id: photoId } = await params
    const photo = await getPhotoByIdCrossPartition(photoId)
    
    if (!photo || photo.moderationStatus !== 'approved') {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    const body = await request.json()
    const validation = validateInput(commentSchema, body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: formatValidationErrors(validation.errors) },
        { status: 400 }
      )
    }
    
    // Content moderation
    try {
      const moderation = await moderateText(validation.data.content)
      if (!moderation.isApproved) {
        return NextResponse.json(
          { error: 'Comment contains inappropriate content' },
          { status: 400 }
        )
      }
    } catch (e) {
      console.error('Comment moderation failed:', e)
      // Continue if moderation service fails
    }
    
    const comment: Comment = {
      id: uuidv4(),
      photoId,
      userId: session.user.id,
      userName: session.user.name,
      content: validation.data.content,
      createdAt: new Date().toISOString(),
      partitionKey: photoId,
    }
    
    await createComment(comment)
    
    // Update photo comment count
    try {
      await updatePhotoStats(photoId, photo.creatorId)
    } catch (e) {
      console.error('Failed to update photo stats:', e)
    }
    
    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        userName: comment.userName,
        createdAt: comment.createdAt,
      },
    })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
