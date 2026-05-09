import createClient, { ImageAnalysisResultOutput } from '@azure-rest/ai-vision-image-analysis'
import { AzureKeyCredential } from '@azure/core-auth'
import type { ImageAnalysisResult } from '@/types'

// Create Vision client
function getVisionClient() {
  const endpoint = process.env.AZURE_VISION_ENDPOINT
  const key = process.env.AZURE_VISION_KEY

  if (!endpoint || !key) {
    throw new Error('Missing Azure Vision configuration. Set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY environment variables.')
  }

  return createClient(endpoint, new AzureKeyCredential(key))
}

/**
 * Analyze an image using Azure Computer Vision
 * @param imageUrl - URL of the image to analyze (must be publicly accessible or use SAS token)
 * @returns Analysis result with tags and description
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
  const client = getVisionClient()

  try {
    const response = await client.path('/imageanalysis:analyze').post({
      body: {
        url: imageUrl,
      },
      queryParameters: {
        features: ['Tags', 'Caption', 'DenseCaptions'],
        language: 'en',
        'gender-neutral-caption': true,
      },
    })

    if (response.status !== '200') {
      console.error('Vision API error:', response.body)
      return {
        tags: [],
        description: '',
        confidence: 0,
      }
    }

    const result = response.body as ImageAnalysisResultOutput

    // Extract tags with confidence > 0.7
    const tags = (result.tagsResult?.values || [])
      .filter((tag) => tag.confidence > 0.7)
      .map((tag) => tag.name.toLowerCase())
      .slice(0, 10) // Limit to 10 tags

    // Get the main caption
    const caption = result.captionResult?.text || ''
    const confidence = result.captionResult?.confidence || 0

    return {
      tags,
      description: caption,
      confidence,
    }
  } catch (error) {
    console.error('Error analyzing image:', error)
    return {
      tags: [],
      description: '',
      confidence: 0,
    }
  }
}

/**
 * Analyze image from a buffer (for server-side processing)
 * @param imageBuffer - Buffer containing the image data
 * @param contentType - MIME type of the image
 * @returns Analysis result with tags and description
 */
export async function analyzeImageFromBuffer(
  imageBuffer: Buffer,
  contentType: string
): Promise<ImageAnalysisResult> {
  const client = getVisionClient()

  try {
    const response = await client.path('/imageanalysis:analyze').post({
      body: imageBuffer,
      contentType: contentType as 'application/octet-stream',
      queryParameters: {
        features: ['Tags', 'Caption', 'DenseCaptions'],
        language: 'en',
        'gender-neutral-caption': true,
      },
    })

    if (response.status !== '200') {
      console.error('Vision API error:', response.body)
      return {
        tags: [],
        description: '',
        confidence: 0,
      }
    }

    const result = response.body as ImageAnalysisResultOutput

    // Extract tags with confidence > 0.7
    const tags = (result.tagsResult?.values || [])
      .filter((tag) => tag.confidence > 0.7)
      .map((tag) => tag.name.toLowerCase())
      .slice(0, 10)

    // Get the main caption
    const caption = result.captionResult?.text || ''
    const confidence = result.captionResult?.confidence || 0

    return {
      tags,
      description: caption,
      confidence,
    }
  } catch (error) {
    console.error('Error analyzing image from buffer:', error)
    return {
      tags: [],
      description: '',
      confidence: 0,
    }
  }
}

/**
 * Generate alt text for accessibility
 * @param imageUrl - URL of the image
 * @returns Generated alt text
 */
export async function generateAltText(imageUrl: string): Promise<string> {
  const result = await analyzeImage(imageUrl)
  
  if (result.description) {
    return result.description
  }
  
  if (result.tags.length > 0) {
    return `Image containing: ${result.tags.slice(0, 5).join(', ')}`
  }
  
  return 'Image'
}

/**
 * Get suggested tags for an image
 * @param imageUrl - URL of the image
 * @returns Array of suggested tags
 */
export async function getSuggestedTags(imageUrl: string): Promise<string[]> {
  const result = await analyzeImage(imageUrl)
  return result.tags
}
