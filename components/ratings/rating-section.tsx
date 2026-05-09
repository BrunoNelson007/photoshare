'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface RatingSectionProps {
  photoId: string
  creatorId: string
  averageRating: number
  ratingCount: number
  userRating?: number
  isAuthenticated: boolean
}

export function RatingSection({
  photoId,
  creatorId,
  averageRating,
  ratingCount,
  userRating,
  isAuthenticated,
}: RatingSectionProps) {
  const router = useRouter()
  const [hoveredRating, setHoveredRating] = useState(0)
  const [currentRating, setCurrentRating] = useState(userRating || 0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRate = async (rating: number) => {
    if (!isAuthenticated) return
    
    setIsSubmitting(true)
    setCurrentRating(rating)
    
    try {
      const response = await fetch(`/api/photos/${photoId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit rating')
      }
      
      toast.success('Rating submitted!')
      router.refresh()
    } catch (error) {
      setCurrentRating(userRating || 0)
      toast.error(error instanceof Error ? error.message : 'Failed to submit rating')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Star className="h-4 w-4" />
          Rating
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="font-bold ml-1">{averageRating.toFixed(1)}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            ({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})
          </span>
        </div>
      </div>
      
      {isAuthenticated ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {currentRating ? 'Your rating:' : 'Rate this photo:'}
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                disabled={isSubmitting}
                className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Star
                  className={cn(
                    'h-8 w-8 transition-colors',
                    (hoveredRating || currentRating) >= star
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  )}
                />
              </button>
            ))}
          </div>
          {currentRating > 0 && (
            <p className="text-xs text-muted-foreground">
              You rated this photo {currentRating} star{currentRating !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 bg-muted rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Sign in to rate this photo
          </p>
          <Link href="/login">
            <Button size="sm">Sign In</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
