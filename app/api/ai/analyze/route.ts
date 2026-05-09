import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { analyzeImageFromBuffer } from '@/lib/azure-vision'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/security/rate-limiter'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    if (session.user.role !== 'creator') {
      return NextResponse.json({ error: 'Creator role required' }, { status: 403 })
    }
    
    // Rate limiting
    const rateLimit = await checkRateLimit(session.user.id, 'api:general')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      )
    }
    
    const body = await request.json()
    const { imageData } = body
    
    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 })
    }
    
    // Handle base64 data URL
    if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/)
      
      if (!matches) {
        return NextResponse.json({ error: 'Invalid image data format' }, { status: 400 })
      }
      
      const mimeType = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')
      
      const result = await analyzeImageFromBuffer(buffer, mimeType)
      
      return NextResponse.json({
        tags: result.tags,
        description: result.description,
        confidence: result.confidence,
      })
    }
    
    return NextResponse.json({ error: 'Invalid image data format' }, { status: 400 })
  } catch (error) {
    console.error('Error analyzing image:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
