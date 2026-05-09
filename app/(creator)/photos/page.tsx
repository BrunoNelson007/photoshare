import { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getPhotosByCreator } from '@/lib/azure-cosmos'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AdminHeader } from '@/components/layout/admin-header'
import { PhotoActions } from '@/components/photos/photo-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Upload, 
  Images, 
  Star, 
  MessageSquare, 
  Clock,
  Search,
  Filter,
  CheckCircle,
  XCircle
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'My Photos',
  description: 'Manage your uploaded photos',
}

export default async function PhotosPage() {
  const session = await auth()
  
  let photos: Awaited<ReturnType<typeof getPhotosByCreator>>['items'] = []
  
  try {
    const result = await getPhotosByCreator(session!.user.id, 100)
    photos = result.items
  } catch (error) {
    console.error('Error fetching photos:', error)
  }

  return (
    <div className="space-y-6">
      <AdminHeader 
        title="My Photos"
        subtitle={`${photos.length} photos in your library`}
      />
      
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search photos..."
              className="pl-10"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Link href="/upload">
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload New
          </Button>
        </Link>
      </div>

      {/* Photos Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Images className="h-5 w-5" />
            Photo Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <Images className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No photos yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Start building your photo library by uploading your first photo. 
                Our AI will help you tag and organize it automatically.
              </p>
              <Link href="/upload">
                <Button size="lg" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Your First Photo
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20">Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Location</TableHead>
                    <TableHead className="hidden lg:table-cell">Stats</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {photos.map((photo) => (
                    <TableRow key={photo.id} className="group">
                      <TableCell>
                        <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={photo.thumbnailUrl || photo.imageUrl}
                            alt={photo.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[200px]">{photo.title}</span>
                          {photo.aiTags && photo.aiTags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {photo.aiTags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                              {photo.aiTags.length > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  +{photo.aiTags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-muted-foreground text-sm truncate block max-w-[150px]">
                          {photo.location || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                            {photo.averageRating.toFixed(1)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {photo.commentCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant={
                            photo.moderationStatus === 'approved' ? 'default' :
                            photo.moderationStatus === 'pending' ? 'secondary' : 'destructive'
                          }
                          className="gap-1"
                        >
                          {photo.moderationStatus === 'approved' && <CheckCircle className="h-3 w-3" />}
                          {photo.moderationStatus === 'pending' && <Clock className="h-3 w-3" />}
                          {photo.moderationStatus === 'rejected' && <XCircle className="h-3 w-3" />}
                          {photo.moderationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {new Date(photo.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <PhotoActions 
                          photoId={photo.id} 
                          photoTitle={photo.title}
                          isApproved={photo.moderationStatus === 'approved'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
