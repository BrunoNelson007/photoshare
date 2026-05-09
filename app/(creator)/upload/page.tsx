import { Metadata } from 'next'
import { UploadForm } from '@/components/upload/upload-form'
import { AdminHeader } from '@/components/layout/admin-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Info } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Upload Photo',
  description: 'Upload a new photo to share',
}

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <AdminHeader 
        title="Upload Photo"
        subtitle="Share a new photo with the community"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Upload Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload New Photo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UploadForm />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5" />
                Upload Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Supported Formats</h4>
                <p className="text-sm text-muted-foreground">JPEG, PNG, WebP, and GIF images are accepted.</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">File Size</h4>
                <p className="text-sm text-muted-foreground">Maximum file size is 10MB per image.</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">AI Analysis</h4>
                <p className="text-sm text-muted-foreground">Our AI will automatically analyze and tag your photo to help with discoverability.</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Moderation</h4>
                <p className="text-sm text-muted-foreground">All photos are reviewed before being made public to ensure community guidelines are followed.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h4 className="font-medium mb-2">💡 Tips for Great Photos</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Use descriptive titles that help viewers understand your photo</li>
                <li>• Add location info to help others discover your work</li>
                <li>• Tag people in your photos for better organization</li>
                <li>• Write captions that tell the story behind the image</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
