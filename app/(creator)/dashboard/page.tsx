import { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getPhotosByCreator } from '@/lib/azure-cosmos'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AdminHeader } from '@/components/layout/admin-header'
import { 
  Upload, 
  Images, 
  Star, 
  MessageSquare, 
  TrendingUp, 
  Clock,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Sparkles,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Creator Dashboard',
  description: 'Manage your photos and view analytics',
}

export default async function DashboardPage() {
  const session = await auth()
  
  let photos: Awaited<ReturnType<typeof getPhotosByCreator>>['items'] = []
  let stats = {
    totalPhotos: 0,
    totalRatings: 0,
    totalComments: 0,
    avgRating: 0,
    pendingPhotos: 0,
    approvedPhotos: 0,
    rejectedPhotos: 0,
  }
  
  try {
    const result = await getPhotosByCreator(session!.user.id, 100)
    photos = result.items
    
    stats = {
      totalPhotos: photos.length,
      totalRatings: photos.reduce((sum, p) => sum + p.ratingCount, 0),
      totalComments: photos.reduce((sum, p) => sum + p.commentCount, 0),
      avgRating: photos.length > 0 
        ? photos.reduce((sum, p) => sum + p.averageRating * p.ratingCount, 0) / 
          Math.max(1, photos.reduce((sum, p) => sum + p.ratingCount, 0))
        : 0,
      pendingPhotos: photos.filter(p => p.moderationStatus === 'pending').length,
      approvedPhotos: photos.filter(p => p.moderationStatus === 'approved').length,
      rejectedPhotos: photos.filter(p => p.moderationStatus === 'rejected').length,
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
  }
  
  const recentPhotos = photos.slice(0, 5)

  return (
    <div className="space-y-6">
      <AdminHeader 
        title={`Welcome back, ${session?.user.name?.split(' ')[0]}`}
        subtitle="Here's what's happening with your photos today"
      />
      
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/upload">
          <Button className="gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">
            <Upload className="h-4 w-4" />
            Upload New Photo
          </Button>
        </Link>
        <Link href="/photos">
          <Button variant="outline" className="gap-2">
            <Images className="h-4 w-4" />
            View All Photos
          </Button>
        </Link>
      </div>
      
      {/* Stats Grid - AdminLTE style info boxes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Photos</p>
                <p className="text-2xl font-bold">{stats.totalPhotos}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Images className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs">
              <span className="flex items-center text-emerald-500">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                12%
              </span>
              <span className="text-muted-foreground ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs">
              <span className="text-muted-foreground">{stats.totalRatings} total ratings</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Comments</p>
                <p className="text-2xl font-bold">{stats.totalComments}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs">
              <span className="flex items-center text-emerald-500">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                8%
              </span>
              <span className="text-muted-foreground ml-2">from last week</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Engagement</p>
                <p className="text-2xl font-bold">{stats.totalRatings + stats.totalComments}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs">
              <span className="text-muted-foreground">Total interactions</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Photos - Main Column */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Photos</CardTitle>
                <CardDescription>Your latest uploaded photos</CardDescription>
              </div>
              <Link href="/photos">
                <Button variant="outline" size="sm" className="gap-1">
                  View All
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentPhotos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Images className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No photos yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first photo to get started
                </p>
                <Link href="/upload">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={photo.thumbnailUrl || photo.imageUrl}
                        alt={photo.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{photo.title}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          {photo.averageRating.toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {photo.commentCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(photo.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        photo.moderationStatus === 'approved' ? 'default' :
                        photo.moderationStatus === 'pending' ? 'secondary' : 'destructive'
                      }
                      className="flex-shrink-0 gap-1"
                    >
                      {photo.moderationStatus === 'approved' && <CheckCircle className="h-3 w-3" />}
                      {photo.moderationStatus === 'pending' && <Clock className="h-3 w-3" />}
                      {photo.moderationStatus === 'rejected' && <XCircle className="h-3 w-3" />}
                      {photo.moderationStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          {/* Moderation Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Photo Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Approved
                  </span>
                  <span className="font-medium">{stats.approvedPhotos}</span>
                </div>
                <Progress 
                  value={stats.totalPhotos > 0 ? (stats.approvedPhotos / stats.totalPhotos) * 100 : 0} 
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Pending
                  </span>
                  <span className="font-medium">{stats.pendingPhotos}</span>
                </div>
                <Progress 
                  value={stats.totalPhotos > 0 ? (stats.pendingPhotos / stats.totalPhotos) * 100 : 0} 
                  className="h-2 [&>div]:bg-amber-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Rejected
                  </span>
                  <span className="font-medium">{stats.rejectedPhotos}</span>
                </div>
                <Progress 
                  value={stats.totalPhotos > 0 ? (stats.rejectedPhotos / stats.totalPhotos) * 100 : 0} 
                  className="h-2 [&>div]:bg-destructive"
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Use AI tagging to automatically categorize your photos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Add locations to help users discover your content</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Tag people to increase engagement</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
