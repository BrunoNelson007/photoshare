import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  getPhotoByIdCrossPartition, 
  createOrUpdateRating, 
  getUserRatingForPhoto,
  getPhotoRatings,
  updatePhotoStats 
} from '@/lib/azure-cosmos'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/security/rate-limiter'
import { ratingSchema, validateInput, formatValidationErrors } from '@/lib/validation/schemas'
import type { Rating } from '@/types'
import { v4 as uuidv4 } from 'uuid'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await auth()
    
    const photo = await getPhotoByIdCrossPartition(id)
    
    if (!photo || photo.moderationStatus !== 'approved') {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    const ratings = await getPhotoRatings(id)
    let userRating: number | null = null
    
    if (session?.user) {
      const existing = await getUserRatingForPhoto(session.user.id, id)
      userRating = existing?.rating || null
    }
    
    return NextResponse.json({
      average: ratings.average,
      count: ratings.count,
      userRating,
    })
  } catch (error) {
    console.error('Error fetching ratings:', error)
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Rate limiting
    const rateLimit = await checkRateLimit(session.user.id, 'rating:create')
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
    
    // Don't allow creators to rate their own photos
    if (photo.creatorId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot rate your own photo' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const validation = validateInput(ratingSchema, body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: formatValidationErrors(validation.errors) },
        { status: 400 }
      )
    }
    
    const rating: Rating = {
      id: uuidv4(),
      photoId,
      userId: session.user.id,
      rating: validation.data.rating,
      createdAt: new Date().toISOString(),
      partitionKey: photoId,
    }
    
    await createOrUpdateRating(rating)
    
    // Update photo rating stats
    try {
      await updatePhotoStats(photoId, photo.creatorId)
    } catch (e) {
      console.error('Failed to update photo stats:', e)
    }
    
    // Get updated ratings
    const ratings = await getPhotoRatings(photoId)
    
    return NextResponse.json({
      success: true,
      rating: validation.data.rating,
      average: ratings.average,
      count: ratings.count,
    })
  } catch (error) {
    console.error('Error creating rating:', error)
    return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 })
  }
}
