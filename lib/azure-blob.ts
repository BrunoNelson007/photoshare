import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  SASProtocol,
} from '@azure/storage-blob'

// Blob Storage client singleton
let blobServiceClient: BlobServiceClient | null = null
let containerClient: ContainerClient | null = null

function getCredential(): StorageSharedKeyCredential {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY

  if (!accountName || !accountKey) {
    throw new Error('Missing Azure Storage configuration. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.')
  }

  return new StorageSharedKeyCredential(accountName, accountKey)
}

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
    const credential = getCredential()
    blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    )
  }
  return blobServiceClient
}

async function getContainerClient(): Promise<ContainerClient> {
  if (!containerClient) {
    const containerName = process.env.AZURE_STORAGE_CONTAINER || 'photos'
    const client = getBlobServiceClient()
    containerClient = client.getContainerClient(containerName)
    
    // Create container if it doesn't exist (private access)
    await containerClient.createIfNotExists()
  }
  return containerClient
}

/**
 * Generate a SAS URL for uploading a blob
 * @param blobName - The name of the blob to upload
 * @param expiresInMinutes - How long the SAS token should be valid (default: 15 minutes)
 * @returns Upload URL with SAS token
 */
export async function generateUploadSasUrl(
  blobName: string,
  expiresInMinutes = 15
): Promise<string> {
  const container = await getContainerClient()
  const blobClient = container.getBlobClient(blobName)
  const credential = getCredential()

  const startsOn = new Date()
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000)

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: process.env.AZURE_STORAGE_CONTAINER || 'photos',
      blobName,
      permissions: BlobSASPermissions.parse('cw'), // Create and Write
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  ).toString()

  return `${blobClient.url}?${sasToken}`
}

/**
 * Generate a SAS URL for reading a blob (time-limited access)
 * @param blobName - The name of the blob to read
 * @param expiresInMinutes - How long the SAS token should be valid (default: 60 minutes)
 * @returns Read URL with SAS token
 */
export async function generateReadSasUrl(
  blobName: string,
  expiresInMinutes = 60
): Promise<string> {
  const container = await getContainerClient()
  const blobClient = container.getBlobClient(blobName)
  const credential = getCredential()

  const startsOn = new Date()
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000)

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: process.env.AZURE_STORAGE_CONTAINER || 'photos',
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read only
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  ).toString()

  return `${blobClient.url}?${sasToken}`
}

/**
 * Upload a blob directly from a Buffer
 * @param blobName - The name of the blob
 * @param content - The content to upload
 * @param contentType - The MIME type of the content
 * @returns The URL of the uploaded blob (without SAS, for storage in DB)
 */
export async function uploadBlob(
  blobName: string,
  content: Buffer,
  contentType: string
): Promise<string> {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobName)

  await blockBlobClient.uploadData(content, {
    blobHTTPHeaders: {
      blobContentType: contentType,
      blobCacheControl: 'public, max-age=31536000', // 1 year cache
    },
  })

  return blockBlobClient.url
}

/**
 * Delete a blob
 * @param blobName - The name of the blob to delete
 * @returns True if deleted successfully
 */
export async function deleteBlob(blobName: string): Promise<boolean> {
  const container = await getContainerClient()
  const blobClient = container.getBlobClient(blobName)

  try {
    await blobClient.deleteIfExists()
    return true
  } catch {
    return false
  }
}

/**
 * Check if a blob exists
 * @param blobName - The name of the blob
 * @returns True if the blob exists
 */
export async function blobExists(blobName: string): Promise<boolean> {
  const container = await getContainerClient()
  const blobClient = container.getBlobClient(blobName)
  return blobClient.exists()
}

/**
 * Get blob properties (size, content type, etc.)
 * @param blobName - The name of the blob
 * @returns Blob properties or null if not found
 */
export async function getBlobProperties(blobName: string): Promise<{
  contentLength: number
  contentType: string
  createdOn: Date
} | null> {
  const container = await getContainerClient()
  const blobClient = container.getBlobClient(blobName)

  try {
    const properties = await blobClient.getProperties()
    return {
      contentLength: properties.contentLength || 0,
      contentType: properties.contentType || 'application/octet-stream',
      createdOn: properties.createdOn || new Date(),
    }
  } catch {
    return null
  }
}

/**
 * Generate blob names for a photo upload
 * @param photoId - The photo ID
 * @param extension - File extension (e.g., 'jpg', 'png')
 * @returns Object with image and thumbnail blob names
 */
export function generateBlobNames(photoId: string, extension: string): {
  image: string
  thumbnail: string
} {
  return {
    image: `photos/${photoId}/image.${extension}`,
    thumbnail: `photos/${photoId}/thumbnail.${extension}`,
  }
}

/**
 * Extract blob name from a full URL
 * @param url - The full blob URL
 * @returns The blob name
 */
export function extractBlobName(url: string): string {
  const urlObj = new URL(url)
  // Remove leading slash and container name
  const path = urlObj.pathname
  const parts = path.split('/')
  // Skip empty string and container name
  return parts.slice(2).join('/')
}
