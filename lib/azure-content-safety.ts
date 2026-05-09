import ContentSafetyClient, { isUnexpected } from '@azure-rest/ai-content-safety'
import { AzureKeyCredential } from '@azure/core-auth'
import type { ContentModerationResult } from '@/types'

// Severity thresholds (0-6 scale, where 0 is safe and 6 is most severe)
const SEVERITY_THRESHOLD = 2 // Reject content with severity >= 2

// Create Content Safety client
function getContentSafetyClient() {
  const endpoint = process.env.AZURE_CONTENT_SAFETY_ENDPOINT
  const key = process.env.AZURE_CONTENT_SAFETY_KEY

  if (!endpoint || !key) {
    throw new Error('Missing Azure Content Safety configuration. Set AZURE_CONTENT_SAFETY_ENDPOINT and AZURE_CONTENT_SAFETY_KEY environment variables.')
  }

  return ContentSafetyClient(endpoint, new AzureKeyCredential(key))
}

/**
 * Moderate an image using Azure Content Safety
 * @param imageUrl - URL of the image to moderate (must be publicly accessible or use SAS token)
 * @returns Moderation result
 */
export async function moderateImage(imageUrl: string): Promise<ContentModerationResult> {
  const client = getContentSafetyClient()

  try {
    const response = await client.path('/image:analyze').post({
      body: {
        image: {
          url: imageUrl,
        },
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        outputType: 'FourSeverityLevels',
      },
    })

    if (isUnexpected(response)) {
      console.error('Content Safety API error:', response.body)
      // In case of error, mark as pending for manual review
      return {
        isApproved: false,
        reason: 'Unable to analyze content - pending manual review',
        categories: { hate: 0, selfHarm: 0, sexual: 0, violence: 0 },
      }
    }

    const result = response.body

    // Extract severity scores
    const categories = {
      hate: 0,
      selfHarm: 0,
      sexual: 0,
      violence: 0,
    }

    const rejectionReasons: string[] = []

    for (const category of result.categoriesAnalysis || []) {
      const severity = category.severity || 0
      
      switch (category.category) {
        case 'Hate':
          categories.hate = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('hate content')
          }
          break
        case 'SelfHarm':
          categories.selfHarm = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('self-harm content')
          }
          break
        case 'Sexual':
          categories.sexual = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('sexual content')
          }
          break
        case 'Violence':
          categories.violence = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('violent content')
          }
          break
      }
    }

    const isApproved = rejectionReasons.length === 0

    return {
      isApproved,
      reason: isApproved ? undefined : `Contains: ${rejectionReasons.join(', ')}`,
      categories,
    }
  } catch (error) {
    console.error('Error moderating image:', error)
    // In case of error, mark as pending for manual review
    return {
      isApproved: false,
      reason: 'Unable to analyze content - pending manual review',
      categories: { hate: 0, selfHarm: 0, sexual: 0, violence: 0 },
    }
  }
}

/**
 * Moderate an image from a buffer
 * @param imageBuffer - Buffer containing the image data
 * @returns Moderation result
 */
export async function moderateImageFromBuffer(imageBuffer: Buffer): Promise<ContentModerationResult> {
  const client = getContentSafetyClient()

  try {
    const base64Content = imageBuffer.toString('base64')

    const response = await client.path('/image:analyze').post({
      body: {
        image: {
          content: base64Content,
        },
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        outputType: 'FourSeverityLevels',
      },
    })

    if (isUnexpected(response)) {
      console.error('Content Safety API error:', response.body)
      return {
        isApproved: false,
        reason: 'Unable to analyze content - pending manual review',
        categories: { hate: 0, selfHarm: 0, sexual: 0, violence: 0 },
      }
    }

    const result = response.body

    const categories = {
      hate: 0,
      selfHarm: 0,
      sexual: 0,
      violence: 0,
    }

    const rejectionReasons: string[] = []

    for (const category of result.categoriesAnalysis || []) {
      const severity = category.severity || 0
      
      switch (category.category) {
        case 'Hate':
          categories.hate = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('hate content')
          }
          break
        case 'SelfHarm':
          categories.selfHarm = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('self-harm content')
          }
          break
        case 'Sexual':
          categories.sexual = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('sexual content')
          }
          break
        case 'Violence':
          categories.violence = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('violent content')
          }
          break
      }
    }

    const isApproved = rejectionReasons.length === 0

    return {
      isApproved,
      reason: isApproved ? undefined : `Contains: ${rejectionReasons.join(', ')}`,
      categories,
    }
  } catch (error) {
    console.error('Error moderating image from buffer:', error)
    return {
      isApproved: false,
      reason: 'Unable to analyze content - pending manual review',
      categories: { hate: 0, selfHarm: 0, sexual: 0, violence: 0 },
    }
  }
}

/**
 * Moderate text content (for comments, captions, etc.)
 * @param text - Text to moderate
 * @returns Moderation result
 */
export async function moderateText(text: string): Promise<ContentModerationResult> {
  const client = getContentSafetyClient()

  try {
    const response = await client.path('/text:analyze').post({
      body: {
        text,
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        outputType: 'FourSeverityLevels',
      },
    })

    if (isUnexpected(response)) {
      console.error('Content Safety API error:', response.body)
      return {
        isApproved: true, // Allow text by default if moderation fails
        categories: { hate: 0, selfHarm: 0, sexual: 0, violence: 0 },
      }
    }

    const result = response.body

    const categories = {
      hate: 0,
      selfHarm: 0,
      sexual: 0,
      violence: 0,
    }

    const rejectionReasons: string[] = []

    for (const category of result.categoriesAnalysis || []) {
      const severity = category.severity || 0
      
      switch (category.category) {
        case 'Hate':
          categories.hate = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('hate speech')
          }
          break
        case 'SelfHarm':
          categories.selfHarm = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('self-harm content')
          }
          break
        case 'Sexual':
          categories.sexual = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('sexual content')
          }
          break
        case 'Violence':
          categories.violence = severity
          if (severity >= SEVERITY_THRESHOLD) {
            rejectionReasons.push('violent content')
          }
          break
      }
    }

    const isApproved = rejectionReasons.length === 0

    return {
      isApproved,
      reason: isApproved ? undefined : `Contains: ${rejectionReasons.join(', ')}`,
      categories,
    }
  } catch (error) {
    console.error('Error moderating text:', error)
    return {
      isApproved: true, // Allow text by default if moderation fails
      categories: { hate: 0, selfHarm: 0, sexual: 0, violence: 0 },
    }
  }
}
