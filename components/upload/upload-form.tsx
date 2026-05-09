'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  X, 
  ImageIcon, 
  MapPin, 
  Users, 
  Sparkles,
  AlertCircle,
  CheckCircle,
  Type,
  FileText
} from 'lucide-react'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface UploadState {
  status: 'idle' | 'uploading' | 'analyzing' | 'saving' | 'complete' | 'error'
  progress: number
  message: string
}

export function UploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [people, setPeople] = useState<string[]>([])
  const [personInput, setPersonInput] = useState('')
  const [aiTags, setAiTags] = useState<string[]>([])
  const [aiDescription, setAiDescription] = useState('')
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    message: '',
  })
  const [error, setError] = useState('')

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError('')
    
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)')
      return
    }
    
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB')
      return
    }
    
    setFile(selectedFile)
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
    
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
      setTitle(nameWithoutExt.replace(/[_-]/g, ' '))
    }
  }, [title])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setAiTags([])
    setAiDescription('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const addPerson = () => {
    const trimmed = personInput.trim()
    if (trimmed && !people.includes(trimmed) && people.length < 10) {
      setPeople([...people, trimmed])
      setPersonInput('')
    }
  }

  const removePerson = (person: string) => {
    setPeople(people.filter(p => p !== person))
  }

  const analyzeImage = async () => {
    if (!preview) return
    
    setUploadState({ status: 'analyzing', progress: 30, message: 'Analyzing image with AI...' })
    
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: preview }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setAiTags(data.tags || [])
        setAiDescription(data.description || '')
        toast.success('AI analysis complete')
      }
    } catch (err) {
      console.error('AI analysis error:', err)
    } finally {
      setUploadState({ status: 'idle', progress: 0, message: '' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!file) {
      setError('Please select an image to upload')
      return
    }
    
    if (!title.trim()) {
      setError('Please enter a title for your photo')
      return
    }
    
    try {
      setUploadState({ status: 'uploading', progress: 10, message: 'Uploading image...' })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title.trim())
      formData.append('caption', caption.trim())
      formData.append('location', location.trim())
      formData.append('people', JSON.stringify(people))
      formData.append('aiTags', JSON.stringify(aiTags))
      formData.append('aiDescription', aiDescription)
      
      const response = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }
      
      setUploadState({ status: 'complete', progress: 100, message: 'Upload complete!' })
      
      toast.success('Photo uploaded successfully!', {
        description: 'Your photo is being processed for moderation.',
      })
      
      setTimeout(() => {
        router.push('/photos')
        router.refresh()
      }, 1500)
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      setUploadState({ status: 'error', progress: 0, message })
      toast.error('Upload failed', { description: message })
    }
  }

  const isProcessing = uploadState.status !== 'idle' && uploadState.status !== 'error'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Bar */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              {uploadState.message}
            </span>
            <span className="font-medium">{uploadState.progress}%</span>
          </div>
          <Progress value={uploadState.progress} className="h-2" />
        </div>
      )}

      {/* Success Message */}
      {uploadState.status === 'complete' && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Photo uploaded successfully! Redirecting to your photos...
          </AlertDescription>
        </Alert>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          relative rounded-lg border-2 border-dashed transition-colors
          ${preview ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        
        {preview ? (
          <div className="relative aspect-video">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain rounded-lg"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-3 right-3 h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                clearFile()
              }}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ImageIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-medium text-lg mb-1">Drop your image here</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              or click to browse from your computer
            </p>
            <p className="text-xs text-muted-foreground">
              Supports: JPEG, PNG, WebP, GIF (max 10MB)
            </p>
          </div>
        )}
      </div>

      {/* AI Analysis Button */}
      {preview && aiTags.length === 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={analyzeImage}
          disabled={isProcessing}
          className="w-full gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Analyze with AI
        </Button>
      )}

      {/* AI Tags Display */}
      {aiTags.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">AI-Generated Tags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          {aiDescription && (
            <p className="mt-3 text-sm text-muted-foreground">{aiDescription}</p>
          )}
        </div>
      )}

      {/* Form Fields */}
      <FieldGroup>
        <Field>
          <FieldLabel className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Title <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your photo a descriptive title"
            disabled={isProcessing}
            maxLength={100}
          />
        </Field>

        <Field>
          <FieldLabel className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Caption
          </FieldLabel>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Tell the story behind this photo..."
            rows={3}
            disabled={isProcessing}
            maxLength={500}
          />
        </Field>

        <Field>
          <FieldLabel className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </FieldLabel>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where was this photo taken?"
            disabled={isProcessing}
          />
        </Field>

        <Field>
          <FieldLabel className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            People in Photo
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              value={personInput}
              onChange={(e) => setPersonInput(e.target.value)}
              placeholder="Add a name"
              disabled={isProcessing || people.length >= 10}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addPerson()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addPerson}
              disabled={isProcessing || people.length >= 10 || !personInput.trim()}
            >
              Add
            </Button>
          </div>
          {people.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {people.map((person) => (
                <Badge key={person} variant="secondary" className="gap-1 pr-1">
                  {person}
                  <button
                    type="button"
                    onClick={() => removePerson(person)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    disabled={isProcessing}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </Field>
      </FieldGroup>

      {/* Submit Button */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isProcessing || !file}
          className="flex-1 gap-2"
        >
          {isProcessing ? (
            <>
              <Spinner className="h-4 w-4" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload Photo
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
