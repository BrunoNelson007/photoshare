"use server"

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import Auth0 from 'next-auth/providers/auth0'
import Credentials from 'next-auth/providers/credentials'
import { getUserByEmail, createUser, getUserById } from './azure-cosmos'
import type { User, UserRole } from '@/types'
import { v4 as uuidv4 } from 'uuid'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      image?: string
    }
  }
  
  interface User {
    id: string
    email: string
    name: string
    role: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    name: string
    role: UserRole
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    // Auth0 Provider - Primary authentication method
    Auth0({
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
      issuer: process.env.AUTH0_ISSUER_BASE_URL!,
      authorization: {
        params: {
          scope: 'openid profile email',
        },
      },
    }),
    // Credentials Provider - For demo/development without Auth0
    Credentials({
      id: 'credentials',
      name: 'Demo Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        action: { label: 'Action', type: 'text' },
        name: { label: 'Name', type: 'text' },
        role: { label: 'Role', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const email = credentials.email as string
        const password = credentials.password as string
        const action = credentials.action as string
        const name = credentials.name as string
        const role = (credentials.role as UserRole) || 'consumer'

        if (action === 'register') {
          const existingUser = await getUserByEmail(email)
          if (existingUser) {
            throw new Error('User already exists')
          }

          const userId = uuidv4()
          const newUser: User = {
            id: userId,
            email,
            name: name || email.split('@')[0],
            role,
            createdAt: new Date().toISOString(),
            partitionKey: userId,
          }

          try {
            await createUser(newUser)
            return {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              role: newUser.role,
            }
          } catch (error) {
            console.error('Error creating user:', error)
            throw new Error('Failed to create user')
          }
        }

        // Login flow
        const user = await getUserByEmail(email)
        if (!user) {
          throw new Error('User not found')
        }

        if (password.length < 6) {
          throw new Error('Invalid password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Auth0 login, sync user to Cosmos DB
      if (account?.provider === 'auth0' && user.email) {
        try {
          let dbUser = await getUserByEmail(user.email)
          
          if (!dbUser) {
            // Create user in Cosmos DB on first Auth0 login
            const userId = user.id || uuidv4()
            const newUser: User = {
              id: userId,
              email: user.email,
              name: user.name || user.email.split('@')[0],
              role: 'consumer', // Default role, can be changed later
              createdAt: new Date().toISOString(),
              partitionKey: userId,
              auth0Id: profile?.sub as string,
            }
            await createUser(newUser)
            dbUser = newUser
          }
        } catch (error) {
          console.error('Error syncing Auth0 user:', error)
          // Allow login even if sync fails
        }
      }
      return true
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id
        token.email = user.email || ''
        token.name = user.name || ''
        token.role = user.role || 'consumer'
      }
      
      // For Auth0, fetch role from database
      if (account?.provider === 'auth0' && token.email) {
        try {
          const dbUser = await getUserByEmail(token.email)
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  trustHost: true,
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// Helper to get current session user
export async function getCurrentUser() {
  const session = await auth()
  return session?.user || null
}

// Helper to check if user is authenticated
export async function isAuthenticated() {
  const session = await auth()
  return !!session?.user
}

// Helper to check user role
export async function hasRole(requiredRole: UserRole) {
  const session = await auth()
  if (!session?.user) return false
  
  if (session.user.role === 'creator') return true
  
  return session.user.role === requiredRole
}

// Helper to require authentication
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Authentication required')
  }
  return session.user
}

// Helper to require creator role
export async function requireCreator() {
  const user = await requireAuth()
  if (user.role !== 'creator') {
    throw new Error('Creator role required')
  }
  return user
}
