import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminSidebar } from '@/components/layout/admin-sidebar'

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/login')
  }
  
  if (session.user.role !== 'creator') {
    redirect('/')
  }
  
  return (
    <div className="min-h-screen bg-muted/30">
      <AdminSidebar user={session.user} />
      <div className="md:pl-64">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
