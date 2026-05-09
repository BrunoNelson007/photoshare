import { auth } from '@/lib/auth'
import { ConsumerNav } from '@/components/layout/consumer-nav'

export default async function ConsumerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  return (
    <div className="min-h-screen bg-background">
      <ConsumerNav user={session?.user || null} />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
