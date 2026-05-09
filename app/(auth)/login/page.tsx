'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Camera, AlertCircle, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const errorParam = searchParams.get('error')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(errorParam || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isAuth0Loading, setIsAuth0Loading] = useState(false)

  const handleAuth0SignIn = async () => {
    setIsAuth0Loading(true)
    setError('')
    await signIn('auth0', { callbackUrl })
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        action: 'login',
        redirect: false,
      })

      if (result?.error) {
        setError(result.error === 'CredentialsSignin' ? 'Invalid email or password' : result.error)
        setIsLoading(false)
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } catch {
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Camera className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Auth0 Sign In - Primary Method */}
          <Button 
            type="button" 
            className="w-full" 
            onClick={handleAuth0SignIn}
            disabled={isAuth0Loading || isLoading}
            size="lg"
          >
            {isAuth0Loading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Connecting to Auth0...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-5 w-5" />
                Sign in with Auth0
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Secure authentication powered by Auth0
          </p>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or continue with email
            </span>
          </div>

          {/* Demo Credentials Login */}
          <form onSubmit={handleCredentialsSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || isAuth0Loading}
                  autoComplete="email"
                />
              </Field>
              
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || isAuth0Loading}
                  autoComplete="current-password"
                  minLength={6}
                />
                <FieldError>Password must be at least 6 characters</FieldError>
              </Field>
            </FieldGroup>

            <Button 
              type="submit" 
              variant="outline" 
              className="w-full mt-4" 
              disabled={isLoading || isAuth0Loading}
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Signing in...
                </>
              ) : (
                'Sign In with Email'
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground text-center">
            {"Don't have an account? "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Demo accounts work without Auth0 setup
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
