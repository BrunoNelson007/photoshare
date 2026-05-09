'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, SlidersHorizontal } from 'lucide-react'

interface SearchFiltersProps {
  initialQuery: string
  initialTags: string[]
  initialLocation: string
  initialSort: string
}

export function SearchFilters({
  initialQuery,
  initialTags,
  initialLocation,
  initialSort,
}: SearchFiltersProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState(initialLocation)
  const [sort, setSort] = useState(initialSort)
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (location) params.set('location', location)
    if (sort !== 'date') params.set('sort', sort)
    
    router.push(`/search?${params.toString()}`)
  }

  const clearFilters = () => {
    setQuery('')
    setLocation('')
    setSort('date')
    router.push('/search')
  }

  const hasFilters = query || location || sort !== 'date'

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by title, caption, or tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>
      
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1.5 block">Location</label>
            <Input
              placeholder="Filter by location..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          
          <div className="w-[150px]">
            <label className="text-sm font-medium mb-1.5 block">Sort by</label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Latest</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 pt-6">
            <Button onClick={() => handleSearch()}>Apply Filters</Button>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear All
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Active Filters */}
      {hasFilters && !showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {query && (
            <Badge variant="secondary" className="gap-1">
              Search: {query}
              <button onClick={() => { setQuery(''); handleSearch(); }}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {location && (
            <Badge variant="secondary" className="gap-1">
              Location: {location}
              <button onClick={() => { setLocation(''); handleSearch(); }}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {sort !== 'date' && (
            <Badge variant="secondary" className="gap-1">
              Sort: {sort === 'rating' ? 'Top Rated' : sort}
              <button onClick={() => { setSort('date'); handleSearch(); }}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <button
            onClick={clearFilters}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
