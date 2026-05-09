'use client'

import Link from 'next/link'
import type { Photo } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhotoGridProps {
  photos: Photo[]
  showCreator?: boolean
  variant?: 'feed' | 'grid'
}

export function PhotoGrid({ photos, showCreator = true, variant = 'feed' }: PhotoGridProps) {
  if (photos.length === 0) {
    return null
  }

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-3 gap-1 md:gap-4">
        {photos.map((photo) => (
          <GridPhotoCard key={photo.id} photo={photo} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {photos.map((photo) => (
        <FeedPhotoCard key={photo.id} photo={photo} showCreator={showCreator} />
      ))}
    </div>
  )
}

interface GridPhotoCardProps {
  photo: Photo
}

function GridPhotoCard({ photo }: GridPhotoCardProps) {
  return (
    <Link href={`/photo/${photo.id}`} className="group relative aspect-square">
      <img
        src={photo.thumbnailUrl || photo.imageUrl}
        alt={photo.title}
        className="w-full h-full object-cover"
      />
      {/* Hover overlay - Instagram style */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
        <div className="flex items-center gap-1 text-white font-semibold">
          <Heart className="h-5 w-5 fill-white" />
          <span>{photo.ratingCount}</span>
        </div>
        <div className="flex items-center gap-1 text-white font-semibold">
          <MessageCircle className="h-5 w-5 fill-white" />
          <span>{photo.commentCount}</span>
        </div>
      </div>
    </Link>
  )
}

interface FeedPhotoCardProps {
  photo: Photo
  showCreator?: boolean
}

function FeedPhotoCard({ photo, showCreator = true }: FeedPhotoCardProps) {
  return (
    <article className="border rounded-lg bg-card overflow-hidden">
      {/* Header - Instagram style */}
      {showCreator && (
        <div className="flex items-center justify-between p-3">
          <Link href={`/photo/${photo.id}`} className="flex items-center gap-3">
            <Avatar className="h-8 w-8 ring-2 ring-gradient-to-tr ring-offset-2 ring-offset-background">
              <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-amber-500 to-fuchsia-500 text-white">
                {photo.creatorName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">
                {photo.creatorName || 'Unknown'}
              </span>
              {photo.location && (
                <span className="text-xs text-muted-foreground">{photo.location}</span>
              )}
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      )}
      
      {/* Image */}
      <Link href={`/photo/${photo.id}`}>
        <div className="aspect-square relative bg-muted">
          <img
            src={photo.thumbnailUrl || photo.imageUrl}
            alt={photo.title}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>
      
      {/* Actions - Instagram style */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
              <Heart className="h-6 w-6" strokeWidth={1.5} />
            </Button>
            <Link href={`/photo/${photo.id}`}>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
                <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
              <Share2 className="h-6 w-6" strokeWidth={1.5} />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
            <Bookmark className="h-6 w-6" strokeWidth={1.5} />
          </Button>
        </div>
        
        {/* Likes count */}
        <div className="font-semibold text-sm">
          {photo.ratingCount} {photo.ratingCount === 1 ? 'like' : 'likes'}
        </div>
        
        {/* Caption */}
        <div className="text-sm">
          <Link href={`/photo/${photo.id}`} className="font-semibold hover:underline">
            {photo.creatorName}
          </Link>{' '}
          <span>{photo.title}</span>
          {photo.caption && (
            <span className="text-muted-foreground"> {photo.caption.slice(0, 100)}{photo.caption.length > 100 ? '...' : ''}</span>
          )}
        </div>
        
        {/* Comments preview */}
        {photo.commentCount > 0 && (
          <Link href={`/photo/${photo.id}`} className="text-sm text-muted-foreground hover:text-foreground">
            View all {photo.commentCount} comments
          </Link>
        )}
        
        {/* Tags */}
        {photo.aiTags && photo.aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {photo.aiTags.slice(0, 5).map((tag) => (
              <Link 
                key={tag} 
                href={`/search?tags=${tag}`}
                className="text-xs text-primary hover:underline"
              >
                #{tag.replace(/\s+/g, '')}
              </Link>
            ))}
          </div>
        )}
        
        {/* Timestamp */}
        <time className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {formatRelativeTime(new Date(photo.createdAt))}
        </time>
      </div>
    </article>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
  if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`
  
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
