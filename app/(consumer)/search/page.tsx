import { Metadata } from 'next'
import { Suspense } from 'react'
import { searchPhotos, getApprovedPhotos } from '@/lib/azure-cosmos'
import { PhotoGrid } from '@/components/photos/photo-grid'
import { SearchFilters } from '@/components/search/search-filters'
import { Skeleton } from '@/components/ui/skeleton'
import { Search as SearchIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Search Photos',
  description: 'Search and discover photos',
}

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    tags?: string
    location?: string
    sort?: 'date' | 'rating'
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''
  const tags = params.tags?.split(',').filter(Boolean) || []
  const location = params.location || ''
  const sortBy = params.sort || 'date'
  
  const hasFilters = query || tags.length > 0 || location

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {hasFilters ? 'Search Results' : 'Explore Photos'}
        </h1>
        <p className="text-muted-foreground">
          {hasFilters
            ? `Showing results for "${query || tags.join(', ') || location}"`
            : 'Discover amazing photos from our community'}
        </p>
      </div>
      
      <SearchFilters
        initialQuery={query}
        initialTags={tags}
        initialLocation={location}
        initialSort={sortBy}
      />
      
      <Suspense fallback={<PhotoGridSkeleton />}>
        <SearchResults
          query={query}
          tags={tags}
          location={location}
          sortBy={sortBy}
        />
      </Suspense>
    </div>
  )
}

async function SearchResults({
  query,
  tags,
  location,
  sortBy,
}: {
  query: string
  tags: string[]
  location: string
  sortBy: 'date' | 'rating'
}) {
  let photos: Awaited<ReturnType<typeof searchPhotos>>['items'] = []
  
  try {
    if (query || tags.length > 0 || location) {
      const result = await searchPhotos(query, tags.length > 0 ? tags : undefined, location || undefined, 40)
      photos = result.items
    } else {
      const result = await getApprovedPhotos(40, undefined, sortBy)
      photos = result.items
    }
  } catch (error) {
    console.error('Error searching photos:', error)
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/50">
        <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No photos found</h3>
        <p className="text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {photos.length} {photos.length === 1 ? 'photo' : 'photos'} found
      </p>
      <PhotoGrid photos={photos} />
    </div>
  )
}

function PhotoGridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-square rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}
