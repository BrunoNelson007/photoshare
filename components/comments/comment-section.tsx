'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Comment } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface CommentSectionProps {
  photoId: string
  comments: Comment[]
  isAuthenticated: boolean
  currentUserId?: string
}

export function CommentSection({
  photoId,
  comments,
  isAuthenticated,
  currentUserId,
}: CommentSectionProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!content.trim()) return
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to post comment')
      }
      
      setContent('')
      toast.success('Comment posted!')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comments ({comments.length})
      </h3>
      
      {/* Comment Form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Add a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            maxLength={1000}
            disabled={isSubmitting}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {content.length}/1000
            </span>
            <Button type="submit" size="sm" disabled={!content.trim() || isSubmitting}>
              {isSubmitting ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {isSubmitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="p-4 bg-muted rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Sign in to leave a comment
          </p>
          <Link href="/login">
            <Button size="sm">Sign In</Button>
          </Link>
        </div>
      )}
      
      {/* Comments List */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  )
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="text-xs">
          {comment.userName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{comment.userName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm mt-1 break-words">{comment.content}</p>
      </div>
    </div>
  )
}
