import { Metadata } from 'next'
import Link from 'next/link'
import { getApprovedPhotos } from '@/lib/azure-cosmos'
import { PhotoGrid } from '@/components/photos/photo-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Camera, 
  ArrowRight, 
  Sparkles, 
  Shield, 
  Zap,
  Users,
  TrendingUp
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'PhotoShare - Discover Amazing Photos',
  description: 'Explore and share beautiful photos with our community',
}

export default async function HomePage() {
  let photos: Awaited<ReturnType<typeof getApprovedPhotos>>['items'] = []
  
  try {
    const result = await getApprovedPhotos(20, undefined, 'date')
    photos = result.items
  } catch (error) {
    console.error('Error fetching photos:', error)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section - Instagram inspired */}
      {photos.length === 0 && (
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Gradient Icon */}
            <div className="inline-flex p-4 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-500 mb-8">
              <Camera className="h-12 w-12 text-white" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-balance">
              Share Your Story
              <span className="block text-muted-foreground">Through Photos</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
              Upload your photos, let AI help you organize them, and connect with a community
              of photography enthusiasts worldwide.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 hover:opacity-90 border-0 text-white h-12 px-8">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/search">
                <Button size="lg" variant="outline" className="h-12 px-8">
                  Explore Photos
                </Button>
              </Link>
            </div>
            
            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
              <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI-Powered Tagging
              </div>
              <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm">
                <Shield className="h-4 w-4 text-emerald-500" />
                Content Moderation
              </div>
              <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm">
                <Zap className="h-4 w-4 text-blue-500" />
                Lightning Fast CDN
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Main Feed */}
      {photos.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Feed Column */}
          <div className="lg:col-span-2">
            {/* Stories placeholder - Instagram style */}
            <div className="mb-6 p-4 border rounded-lg bg-card overflow-x-auto">
              <div className="flex gap-4">
                {/* Your story */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                  <span className="text-xs">Your Story</span>
                </div>
                {/* Sample story avatars */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-500">
                      <div className="p-0.5 rounded-full bg-background">
                        <Avatar className="h-14 w-14">
                          <AvatarFallback className="text-sm">U{i}</AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    <span className="text-xs truncate w-16 text-center">user{i}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <PhotoGrid photos={photos} variant="feed" />
          </div>
          
          {/* Sidebar - Instagram style */}
          <aside className="hidden lg:block space-y-6">
            {/* Suggestions */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-muted-foreground">Suggestions For You</span>
                  <Link href="/search" className="text-xs font-semibold hover:text-muted-foreground">
                    See All
                  </Link>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">P{i}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">photographer{i}</p>
                        <p className="text-xs text-muted-foreground">Suggested for you</p>
                      </div>
                      <Button variant="link" size="sm" className="text-xs font-semibold text-primary p-0 h-auto">
                        Follow
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Stats Card */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Community Stats
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{photos.length}</p>
                    <p className="text-xs text-muted-foreground">Photos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {photos.reduce((sum, p) => sum + p.commentCount, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Comments</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Footer links */}
            <div className="text-xs text-muted-foreground space-y-2">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <Link href="#" className="hover:underline">About</Link>
                <Link href="#" className="hover:underline">Help</Link>
                <Link href="#" className="hover:underline">Press</Link>
                <Link href="#" className="hover:underline">API</Link>
                <Link href="#" className="hover:underline">Privacy</Link>
                <Link href="#" className="hover:underline">Terms</Link>
              </div>
              <p>PhotoShare - Scalable CW 2</p>
            </div>
          </aside>
        </div>
      )}
      
      {/* Empty State */}
      {photos.length === 0 && (
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-12">Why PhotoShare?</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="text-center border-0 shadow-none bg-transparent">
                <CardContent className="pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">AI-Powered</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatic image analysis generates tags and descriptions for better discoverability
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center border-0 shadow-none bg-transparent">
                <CardContent className="pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Safe Community</h3>
                  <p className="text-sm text-muted-foreground">
                    Advanced AI ensures a safe and welcoming environment for all users
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center border-0 shadow-none bg-transparent">
                <CardContent className="pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Lightning Fast</h3>
                  <p className="text-sm text-muted-foreground">
                    Built on Azure with global CDN for fast loading times worldwide
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
