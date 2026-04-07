import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

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

  // Get user profile for company name
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_name')
    .eq('user_id', user.id)
    .single()

  const companyName = profile?.company_name || ''

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar companyName={companyName} />
      <main className="md:pl-64">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}