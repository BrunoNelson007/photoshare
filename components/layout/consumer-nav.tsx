'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { 
  Search, 
  Home, 
  LogOut, 
  User, 
  LayoutDashboard,
  Compass,
  Heart,
  PlusSquare,
  MessageCircle,
  Camera
} from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ConsumerNavProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    image?: string
  } | null
}

export function ConsumerNav({ user }: ConsumerNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/search', icon: Compass, label: 'Explore' },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo - Instagram style */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <div className="p-2 bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-500 rounded-xl">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </div>
          <span className="font-bold text-xl hidden sm:inline tracking-tight">PhotoShare</span>
        </Link>
        
        {/* Search Bar - Instagram style */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xs hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </form>
        
        {/* Navigation Icons - Instagram style */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-10 w-10 rounded-lg",
                    isActive && "bg-muted"
                  )}
                >
                  <Icon className={cn("h-6 w-6", isActive ? "fill-current" : "")} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="sr-only">{item.label}</span>
                </Button>
              </Link>
            )
          })}
          
          {/* Search icon for mobile */}
          <Link href="/search" className="md:hidden">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
              <Search className="h-6 w-6" strokeWidth={1.5} />
              <span className="sr-only">Search</span>
            </Button>
          </Link>

          {user ? (
            <>
              {/* Create post button for creators */}
              {user.role === 'creator' && (
                <Link href="/upload">
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
                    <PlusSquare className="h-6 w-6" strokeWidth={1.5} />
                    <span className="sr-only">Create</span>
                  </Button>
                </Link>
              )}
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                    <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-muted-foreground/20 transition-all">
                      <AvatarImage src={user.image} alt={user.name} />
                      <AvatarFallback className="text-xs font-medium">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === 'creator' && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Creator Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-semibold">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="font-semibold bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 hover:opacity-90 border-0">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
