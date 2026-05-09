import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createPhoto, getApprovedPhotos } from '@/lib/azure-cosmos'
import { uploadBlob, generateBlobNames, generateReadSasUrl } from '@/lib/azure-blob'
import { analyzeImage } from '@/lib/azure-vision'
import { moderateImageFromBuffer } from '@/lib/azure-content-safety'
import { checkRateLimit, getClientIp, createRateLimitHeaders } from '@/lib/security/rate-limiter'
import { photoUploadSchema, validateInput, formatValidationErrors } from '@/lib/validation/schemas'
import { validateFile, getExtensionFromMime } from '@/lib/validation/file-validator'
import type { Photo } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const sort = searchParams.get('sort') as 'date' | 'rating' || 'date'
    const continuationToken = searchParams.get('token') || undefined
    
    const result = await getApprovedPhotos(limit, continuationToken, sort)
    
    // Generate signed URLs for images
    const photosWithUrls = await Promise.all(
      result.items.map(async (photo) => {
        try {
          if (photo.imageUrl.includes('blob.core.windows.net')) {
            const blobName = photo.imageUrl.split('/').slice(-2).join('/')
            return {
              ...photo,
              imageUrl: await generateReadSasUrl(blobName, 60),
              thumbnailUrl: photo.thumbnailUrl ? await generateReadSasUrl(
                photo.thumbnailUrl.split('/').slice(-2).join('/'), 60
              ) : undefined,
            }
          }
        } catch (e) {
          console.error('Error generating SAS URL:', e)
        }
        return photo
      })
    )
    
    return NextResponse.json({
      items: photosWithUrls,
      continuationToken: result.continuationToken,
      hasMore: result.hasMore,
    })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    if (session.user.role !== 'creator') {
      return NextResponse.json({ error: 'Creator role required' }, { status: 403 })
    }
    
    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(session.user.id, 'photo:upload')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      )
    }
    
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // Validate file
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileValidation = validateFile(file.name, fileBuffer, file.type)
    
    if (!fileValidation.isValid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 })
    }
    
    // Validate metadata
    const metadata = {
      title: formData.get('title') as string,
      caption: formData.get('caption') as string || undefined,
      location: formData.get('location') as string || undefined,
      people: JSON.parse(formData.get('people') as string || '[]'),
    }
    
    const validation = validateInput(photoUploadSchema, metadata)
    if (!validation.success) {
      return NextResponse.json(
        { error: formatValidationErrors(validation.errors) },
        { status: 400 }
      )
    }
    
    // Generate IDs and blob names
    const photoId = uuidv4()
    const extension = getExtensionFromMime(file.type)
    const blobNames = generateBlobNames(photoId, extension)
    
    // Upload image
    const imageUrl = await uploadBlob(blobNames.image, fileBuffer, file.type)
    
    // For thumbnails, we'd ideally resize on the server
    // For now, use the same image (can be optimized with Azure Functions)
    const thumbnailUrl = imageUrl
    
    // AI Analysis (non-blocking for demo, but we wait for moderation)
    let aiTags: string[] = []
    let aiDescription = ''
    
    // Parse pre-analyzed AI data if provided
    const preAnalyzedTags = formData.get('aiTags')
    const preAnalyzedDescription = formData.get('aiDescription')
    
    if (preAnalyzedTags) {
      aiTags = JSON.parse(preAnalyzedTags as string)
      aiDescription = preAnalyzedDescription as string || ''
    } else {
      try {
        const sasUrl = await generateReadSasUrl(blobNames.image, 5)
        const analysis = await analyzeImage(sasUrl)
        aiTags = analysis.tags
        aiDescription = analysis.description
      } catch (e) {
        console.error('AI analysis failed:', e)
      }
    }
    
    // Content moderation
    let moderationStatus: 'approved' | 'pending' | 'rejected' = 'pending'
    try {
      const moderation = await moderateImageFromBuffer(fileBuffer)
      moderationStatus = moderation.isApproved ? 'approved' : 'rejected'
    } catch (e) {
      console.error('Content moderation failed:', e)
      // Mark as pending for manual review if moderation fails
      moderationStatus = 'pending'
    }
    
    // Create photo record
    const photo: Photo = {
      id: photoId,
      creatorId: session.user.id,
      creatorName: session.user.name,
      title: validation.data.title,
      caption: validation.data.caption,
      location: validation.data.location,
      people: validation.data.people,
      imageUrl,
      thumbnailUrl,
      aiTags,
      aiDescription,
      moderationStatus,
      averageRating: 0,
      ratingCount: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      partitionKey: session.user.id,
    }
    
    await createPhoto(photo)
    
    return NextResponse.json({
      success: true,
      photo: {
        id: photo.id,
        title: photo.title,
        moderationStatus: photo.moderationStatus,
      },
    })
  } catch (error) {
    console.error('Error creating photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}
