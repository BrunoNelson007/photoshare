import { NextRequest, NextResponse } from 'next/server'
import { searchPhotos, getApprovedPhotos } from '@/lib/azure-cosmos'
import { generateReadSasUrl, extractBlobName } from '@/lib/azure-blob'
import { checkRateLimit, getClientIp, createRateLimitHeaders } from '@/lib/security/rate-limiter'
import { searchSchema, validateInput, formatValidationErrors } from '@/lib/validation/schemas'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'search')
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      )
    }
    
    const { searchParams } = new URL(request.url)
    
    const params = {
      query: searchParams.get('q') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      location: searchParams.get('location') || undefined,
      sortBy: searchParams.get('sort') as 'date' | 'rating' | undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      continuationToken: searchParams.get('token') || undefined,
    }
    
    const validation = validateInput(searchSchema, params)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: formatValidationErrors(validation.errors) },
        { status: 400 }
      )
    }
    
    const { query, tags, location, sortBy, limit, continuationToken } = validation.data
    
    let result
    
    if (query || (tags && tags.length > 0) || location) {
      result = await searchPhotos(
        query || '',
        tags,
        location,
        limit,
        continuationToken
      )
    } else {
      result = await getApprovedPhotos(
        limit,
        continuationToken,
        sortBy
      )
    }
    
    // Generate signed URLs for images
    const photosWithUrls = await Promise.all(
      result.items.map(async (photo) => {
        try {
          if (photo.imageUrl.includes('blob.core.windows.net')) {
            const imageBlobName = extractBlobName(photo.imageUrl)
            const imageUrl = await generateReadSasUrl(imageBlobName, 60)
            
            let thumbnailUrl = photo.thumbnailUrl
            if (photo.thumbnailUrl?.includes('blob.core.windows.net')) {
              const thumbBlobName = extractBlobName(photo.thumbnailUrl)
              thumbnailUrl = await generateReadSasUrl(thumbBlobName, 60)
            }
            
            return { ...photo, imageUrl, thumbnailUrl }
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
    console.error('Error searching photos:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
