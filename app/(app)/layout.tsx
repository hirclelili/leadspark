import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import type { UserProfile } from '@/contexts/UserProfileContext'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch full profile server-side — used by sidebar + injected into context
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const companyName = (profile as UserProfile | null)?.company_name || ''

  return (
    <UserProfileProvider initialProfile={profile as UserProfile | null}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar companyName={companyName} />
        <main className="md:pl-64">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </UserProfileProvider>
  )
}
