import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getPhotoByIdCrossPartition, getCommentsByPhoto, getUserRatingForPhoto } from '@/lib/azure-cosmos'
import { generateReadSasUrl } from '@/lib/azure-blob'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, 
  Calendar, 
  ArrowLeft, 
  Sparkles,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreHorizontal
} from 'lucide-react'
import { CommentSection } from '@/components/comments/comment-section'
import { RatingSection } from '@/components/ratings/rating-section'

interface PhotoPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PhotoPageProps): Promise<Metadata> {
  const { id } = await params
  const photo = await getPhotoByIdCrossPartition(id)
  
  if (!photo) {
    return { title: 'Photo Not Found' }
  }
  
  return {
    title: photo.title,
    description: photo.caption || photo.aiDescription || `Photo by ${photo.creatorName}`,
  }
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params
  const session = await auth()
  
  const photo = await getPhotoByIdCrossPartition(id)
  
  if (!photo || photo.moderationStatus !== 'approved') {
    notFound()
  }
  
  // Get comments and user rating
  const [commentsResult, userRating] = await Promise.all([
    getCommentsByPhoto(photo.id, 50),
    session?.user ? getUserRatingForPhoto(session.user.id, photo.id) : null,
  ])
  
  // Generate signed URL for the image
  let imageUrl = photo.imageUrl
  try {
    if (photo.imageUrl.includes('blob.core.windows.net')) {
      const blobName = photo.imageUrl.split('/').slice(-2).join('/')
      imageUrl = await generateReadSasUrl(blobName, 60)
    }
  } catch (error) {
    console.error('Error generating SAS URL:', error)
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Button - Mobile only */}
      <div className="md:hidden mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>
      
      {/* Instagram-style Post Layout */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="grid md:grid-cols-5">
          {/* Image Section - Takes up more space */}
          <div className="md:col-span-3 bg-black flex items-center justify-center">
            <img
              src={imageUrl}
              alt={photo.title}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </div>
          
          {/* Details Section */}
          <div className="md:col-span-2 flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-500">
                  <div className="p-0.5 rounded-full bg-background">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs font-medium">
                        {photo.creatorName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">{photo.creatorName || 'Unknown Creator'}</p>
                  {photo.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {photo.location}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Caption */}
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {photo.creatorName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm">
                    <span className="font-semibold">{photo.creatorName}</span>{' '}
                    <span className="font-medium">{photo.title}</span>
                    {photo.caption && <span className="text-muted-foreground"> {photo.caption}</span>}
                  </p>
                  <time className="text-xs text-muted-foreground mt-1 block">
                    {new Date(photo.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              </div>
              
              {/* AI Tags */}
              {photo.aiTags && photo.aiTags.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-xs font-medium mb-2 text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    AI-Generated Tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {photo.aiTags.map((tag) => (
                      <Link key={tag} href={`/search?tags=${tag}`}>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 text-xs">
                          #{tag.replace(/\s+/g, '')}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                  {photo.aiDescription && (
                    <p className="text-xs text-muted-foreground mt-2">{photo.aiDescription}</p>
                  )}
                </div>
              )}
              
              {/* People Tags */}
              {photo.people && photo.people.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">People in this photo</h4>
                  <div className="flex flex-wrap gap-1">
                    {photo.people.map((person) => (
                      <Badge key={person} variant="outline" className="text-xs">
                        @{person}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
              
              {/* Comments Section */}
              <CommentSection
                photoId={photo.id}
                comments={commentsResult.items}
                isAuthenticated={!!session?.user}
                currentUserId={session?.user?.id}
              />
            </div>
            
            {/* Actions Footer */}
            <div className="border-t p-4 space-y-3">
              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
                    <Heart className="h-6 w-6" strokeWidth={1.5} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
                    <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
                    <Share2 className="h-6 w-6" strokeWidth={1.5} />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:scale-110 transition-transform">
                  <Bookmark className="h-6 w-6" strokeWidth={1.5} />
                </Button>
              </div>
              
              {/* Rating Section */}
              <RatingSection
                photoId={photo.id}
                creatorId={photo.creatorId}
                averageRating={photo.averageRating}
                ratingCount={photo.ratingCount}
                userRating={userRating?.rating}
                isAuthenticated={!!session?.user}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
