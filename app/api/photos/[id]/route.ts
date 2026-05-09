import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPhotoByIdCrossPartition, updatePhoto, deletePhoto as deletePhotoFromDb } from '@/lib/azure-cosmos'
import { deleteBlob, extractBlobName, generateReadSasUrl } from '@/lib/azure-blob'
import { photoUpdateSchema, validateInput, formatValidationErrors } from '@/lib/validation/schemas'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/security/rate-limiter'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const photo = await getPhotoByIdCrossPartition(id)
    
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    // Only return approved photos to non-owners
    const session = await auth()
    if (photo.moderationStatus !== 'approved' && photo.creatorId !== session?.user?.id) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    // Generate signed URLs
    let imageUrl = photo.imageUrl
    let thumbnailUrl = photo.thumbnailUrl
    
    try {
      if (photo.imageUrl.includes('blob.core.windows.net')) {
        const imageBlobName = extractBlobName(photo.imageUrl)
        imageUrl = await generateReadSasUrl(imageBlobName, 60)
        
        if (photo.thumbnailUrl) {
          const thumbBlobName = extractBlobName(photo.thumbnailUrl)
          thumbnailUrl = await generateReadSasUrl(thumbBlobName, 60)
        }
      }
    } catch (e) {
      console.error('Error generating SAS URLs:', e)
    }
    
    return NextResponse.json({
      ...photo,
      imageUrl,
      thumbnailUrl,
    })
  } catch (error) {
    console.error('Error fetching photo:', error)
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const { id } = await params
    const photo = await getPhotoByIdCrossPartition(id)
    
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    // Only owner can update
    if (photo.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    
    const body = await request.json()
    const validation = validateInput(photoUpdateSchema, body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: formatValidationErrors(validation.errors) },
        { status: 400 }
      )
    }
    
    const updated = await updatePhoto(id, photo.creatorId, validation.data)
    
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, photo: updated })
  } catch (error) {
    console.error('Error updating photo:', error)
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Rate limiting
    const rateLimit = await checkRateLimit(session.user.id, 'photo:delete')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      )
    }
    
    const { id } = await params
    const photo = await getPhotoByIdCrossPartition(id)
    
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    
    // Only owner can delete
    if (photo.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    
    // Delete from Cosmos DB
    const deleted = await deletePhotoFromDb(id, photo.creatorId)
    
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
    }
    
    // Delete blobs (non-blocking)
    try {
      if (photo.imageUrl.includes('blob.core.windows.net')) {
        const imageBlobName = extractBlobName(photo.imageUrl)
        await deleteBlob(imageBlobName)
        
        if (photo.thumbnailUrl) {
          const thumbBlobName = extractBlobName(photo.thumbnailUrl)
          await deleteBlob(thumbBlobName)
        }
      }
    } catch (e) {
      console.error('Error deleting blobs:', e)
      // Don't fail the request if blob deletion fails
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
