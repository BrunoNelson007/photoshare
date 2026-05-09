import { CosmosClient, Container, Database, SqlQuerySpec } from '@azure/cosmos'
import type {
  User,
  Photo,
  Comment,
  Rating,
  RateLimitRecord,
  AuditLog,
  PaginatedResponse,
} from '@/types'

// Cosmos DB client singleton
let client: CosmosClient | null = null
let database: Database | null = null

function getClient(): CosmosClient {
  if (!client) {
    const endpoint = process.env.COSMOS_DB_ENDPOINT
    const key = process.env.COSMOS_DB_KEY

    if (!endpoint || !key) {
      throw new Error('Missing Cosmos DB configuration. Set COSMOS_DB_ENDPOINT and COSMOS_DB_KEY environment variables.')
    }

    client = new CosmosClient({ endpoint, key })
  }
  return client
}

async function getDatabase(): Promise<Database> {
  if (!database) {
    const dbName = process.env.COSMOS_DB_DATABASE || 'photoshare'
    const { database: db } = await getClient().databases.createIfNotExists({ id: dbName })
    database = db
  }
  return database
}

async function getContainer(containerId: string): Promise<Container> {
  const db = await getDatabase()
  const { container } = await db.containers.createIfNotExists({
    id: containerId,
    partitionKey: { paths: ['/partitionKey'] },
  })
  return container
}

// Container getters
export async function getUsersContainer(): Promise<Container> {
  return getContainer('users')
}

export async function getPhotosContainer(): Promise<Container> {
  return getContainer('photos')
}

export async function getCommentsContainer(): Promise<Container> {
  return getContainer('comments')
}

export async function getRatingsContainer(): Promise<Container> {
  return getContainer('ratings')
}

export async function getRateLimitsContainer(): Promise<Container> {
  return getContainer('ratelimits')
}

export async function getAuditLogsContainer(): Promise<Container> {
  return getContainer('auditlogs')
}

// User operations
export async function createUser(user: User): Promise<User> {
  const container = await getUsersContainer()
  const { resource } = await container.items.create(user)
  return resource as User
}

export async function getUserById(id: string): Promise<User | null> {
  const container = await getUsersContainer()
  try {
    const { resource } = await container.item(id, id).read<User>()
    return resource || null
  } catch {
    return null
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const container = await getUsersContainer()
  const query: SqlQuerySpec = {
    query: 'SELECT * FROM c WHERE c.email = @email',
    parameters: [{ name: '@email', value: email }],
  }
  const { resources } = await container.items.query<User>(query).fetchAll()
  return resources[0] || null
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const container = await getUsersContainer()
  const { resource } = await container.item(id, id).replace({ id, partitionKey: id, ...updates })
  return resource as User
}

// Photo operations
export async function createPhoto(photo: Photo): Promise<Photo> {
  const container = await getPhotosContainer()
  const { resource } = await container.items.create(photo)
  return resource as Photo
}

export async function getPhotoById(id: string, creatorId: string): Promise<Photo | null> {
  const container = await getPhotosContainer()
  try {
    const { resource } = await container.item(id, creatorId).read<Photo>()
    return resource || null
  } catch {
    return null
  }
}

export async function getPhotoByIdCrossPartition(id: string): Promise<Photo | null> {
  const container = await getPhotosContainer()
  const query: SqlQuerySpec = {
    query: 'SELECT * FROM c WHERE c.id = @id',
    parameters: [{ name: '@id', value: id }],
  }
  const { resources } = await container.items.query<Photo>(query).fetchAll()
  return resources[0] || null
}

export async function updatePhoto(id: string, creatorId: string, updates: Partial<Photo>): Promise<Photo | null> {
  const container = await getPhotosContainer()
  const existing = await getPhotoById(id, creatorId)
  if (!existing) return null
  
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
  const { resource } = await container.item(id, creatorId).replace(updated)
  return resource as Photo
}

export async function deletePhoto(id: string, creatorId: string): Promise<boolean> {
  const container = await getPhotosContainer()
  try {
    await container.item(id, creatorId).delete()
    return true
  } catch {
    return false
  }
}

export async function getPhotosByCreator(
  creatorId: string,
  limit = 20,
  continuationToken?: string
): Promise<PaginatedResponse<Photo>> {
  const container = await getPhotosContainer()
  const query: SqlQuerySpec = {
    query: 'SELECT * FROM c WHERE c.creatorId = @creatorId ORDER BY c.createdAt DESC',
    parameters: [{ name: '@creatorId', value: creatorId }],
  }
  
  const iterator = container.items.query<Photo>(query, {
    maxItemCount: limit,
    continuationToken,
  })
  
  const response = await iterator.fetchNext()
  return {
    items: response.resources,
    continuationToken: response.continuationToken,
    hasMore: !!response.continuationToken,
  }
}

export async function getApprovedPhotos(
  limit = 20,
  continuationToken?: string,
  sortBy: 'date' | 'rating' = 'date'
): Promise<PaginatedResponse<Photo>> {
  const container = await getPhotosContainer()
  const orderBy = sortBy === 'rating' ? 'c.averageRating DESC' : 'c.createdAt DESC'
  const query: SqlQuerySpec = {
    query: `SELECT * FROM c WHERE c.moderationStatus = 'approved' ORDER BY ${orderBy}`,
    parameters: [],
  }
  
  const iterator = container.items.query<Photo>(query, {
    maxItemCount: limit,
    continuationToken,
  })
  
  const response = await iterator.fetchNext()
  return {
    items: response.resources,
    continuationToken: response.continuationToken,
    hasMore: !!response.continuationToken,
  }
}

export async function searchPhotos(
  searchQuery: string,
  tags?: string[],
  location?: string,
  limit = 20,
  continuationToken?: string
): Promise<PaginatedResponse<Photo>> {
  const container = await getPhotosContainer()
  
  let queryText = `SELECT * FROM c WHERE c.moderationStatus = 'approved'`
  const parameters: { name: string; value: string | string[] }[] = []
  
  if (searchQuery) {
    queryText += ` AND (CONTAINS(LOWER(c.title), @query) OR CONTAINS(LOWER(c.caption), @query) OR CONTAINS(LOWER(c.aiDescription), @query))`
    parameters.push({ name: '@query', value: searchQuery.toLowerCase() })
  }
  
  if (location) {
    queryText += ` AND CONTAINS(LOWER(c.location), @location)`
    parameters.push({ name: '@location', value: location.toLowerCase() })
  }
  
  if (tags && tags.length > 0) {
    // Check if any of the search tags exist in the photo's aiTags array
    const tagConditions = tags.map((_, i) => `ARRAY_CONTAINS(c.aiTags, @tag${i})`).join(' OR ')
    queryText += ` AND (${tagConditions})`
    tags.forEach((tag, i) => {
      parameters.push({ name: `@tag${i}`, value: tag.toLowerCase() })
    })
  }
  
  queryText += ' ORDER BY c.createdAt DESC'
  
  const query: SqlQuerySpec = { query: queryText, parameters }
  
  const iterator = container.items.query<Photo>(query, {
    maxItemCount: limit,
    continuationToken,
  })
  
  const response = await iterator.fetchNext()
  return {
    items: response.resources,
    continuationToken: response.continuationToken,
    hasMore: !!response.continuationToken,
  }
}

// Comment operations
export async function createComment(comment: Comment): Promise<Comment> {
  const container = await getCommentsContainer()
  const { resource } = await container.items.create(comment)
  return resource as Comment
}

export async function getCommentsByPhoto(
  photoId: string,
  limit = 50,
  continuationToken?: string
): Promise<PaginatedResponse<Comment>> {
  const container = await getCommentsContainer()
  const query: SqlQuerySpec = {
    query: 'SELECT * FROM c WHERE c.photoId = @photoId ORDER BY c.createdAt DESC',
    parameters: [{ name: '@photoId', value: photoId }],
  }
  
  const iterator = container.items.query<Comment>(query, {
    maxItemCount: limit,
    continuationToken,
  })
  
  const response = await iterator.fetchNext()
  return {
    items: response.resources,
    continuationToken: response.continuationToken,
    hasMore: !!response.continuationToken,
  }
}

export async function deleteComment(id: string, photoId: string): Promise<boolean> {
  const container = await getCommentsContainer()
  try {
    await container.item(id, photoId).delete()
    return true
  } catch {
    return false
  }
}

// Rating operations
export async function createOrUpdateRating(rating: Rating): Promise<Rating> {
  const container = await getRatingsContainer()
  const existing = await getUserRatingForPhoto(rating.userId, rating.photoId)
  
  if (existing) {
    const updated = { ...existing, rating: rating.rating, createdAt: new Date().toISOString() }
    const { resource } = await container.item(existing.id, rating.photoId).replace(updated)
    return resource as Rating
  }
  
  const { resource } = await container.items.create(rating)
  return resource as Rating
}

export async function getUserRatingForPhoto(userId: string, photoId: string): Promise<Rating | null> {
  const container = await getRatingsContainer()
  const query: SqlQuerySpec = {
    query: 'SELECT * FROM c WHERE c.userId = @userId AND c.photoId = @photoId',
    parameters: [
      { name: '@userId', value: userId },
      { name: '@photoId', value: photoId },
    ],
  }
  const { resources } = await container.items.query<Rating>(query).fetchAll()
  return resources[0] || null
}

export async function getPhotoRatings(photoId: string): Promise<{ average: number; count: number }> {
  const container = await getRatingsContainer()
  const query: SqlQuerySpec = {
    query: 'SELECT VALUE { "average": AVG(c.rating), "count": COUNT(1) } FROM c WHERE c.photoId = @photoId',
    parameters: [{ name: '@photoId', value: photoId }],
  }
  const { resources } = await container.items.query<{ average: number; count: number }>(query).fetchAll()
  return resources[0] || { average: 0, count: 0 }
}

// Rate limiting operations
export async function getRateLimitRecord(key: string): Promise<RateLimitRecord | null> {
  const container = await getRateLimitsContainer()
  try {
    const { resource } = await container.item(key, key).read<RateLimitRecord>()
    return resource || null
  } catch {
    return null
  }
}

export async function upsertRateLimitRecord(record: RateLimitRecord): Promise<RateLimitRecord> {
  const container = await getRateLimitsContainer()
  const { resource } = await container.items.upsert(record)
  return resource as RateLimitRecord
}

// Audit log operations
export async function createAuditLog(log: AuditLog): Promise<AuditLog> {
  const container = await getAuditLogsContainer()
  const { resource } = await container.items.create(log)
  return resource as AuditLog
}

// Update photo stats (after comment/rating)
export async function updatePhotoStats(photoId: string, creatorId: string): Promise<void> {
  const photo = await getPhotoById(photoId, creatorId)
  if (!photo) return
  
  const ratings = await getPhotoRatings(photoId)
  const commentsContainer = await getCommentsContainer()
  const commentsQuery: SqlQuerySpec = {
    query: 'SELECT VALUE COUNT(1) FROM c WHERE c.photoId = @photoId',
    parameters: [{ name: '@photoId', value: photoId }],
  }
  const { resources } = await commentsContainer.items.query<number>(commentsQuery).fetchAll()
  const commentCount = resources[0] || 0
  
  await updatePhoto(photoId, creatorId, {
    averageRating: ratings.average,
    ratingCount: ratings.count,
    commentCount,
  })
}

// Initialize database with required indexes
export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase()
  
  // Create containers with proper indexing
  const containers = [
    { id: 'users', indexingPolicy: { includedPaths: [{ path: '/*' }] } },
    { id: 'photos', indexingPolicy: { includedPaths: [{ path: '/*' }] } },
    { id: 'comments', indexingPolicy: { includedPaths: [{ path: '/*' }] } },
    { id: 'ratings', indexingPolicy: { includedPaths: [{ path: '/*' }] } },
    { id: 'ratelimits', indexingPolicy: { includedPaths: [{ path: '/*' }] } },
    { id: 'auditlogs', indexingPolicy: { includedPaths: [{ path: '/*' }] } },
  ]
  
  for (const containerDef of containers) {
    await db.containers.createIfNotExists({
      id: containerDef.id,
      partitionKey: { paths: ['/partitionKey'] },
      indexingPolicy: containerDef.indexingPolicy,
    })
  }
}
