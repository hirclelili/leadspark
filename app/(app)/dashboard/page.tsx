import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
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

  // Get stats
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('user_id', user.id)

  const { data: customers } = await supabase
    .from('customers')
    .select('status')
    .eq('user_id', user.id)

  const { data: quotations } = await supabase
    .from('quotations')
    .select('id')
    .eq('user_id', user.id)

  const { data: recentQuotations } = await supabase
    .from('quotations')
    .select('*, customers(company_name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate stats
  const totalProducts = products?.length || 0
  const totalCustomers = customers?.length || 0
  const totalQuotations = quotations?.length || 0
  const customersByStatus = {
    new: customers?.filter(c => c.status === 'new').length || 0,
    quoted: customers?.filter(c => c.status === 'quoted').length || 0,
    negotiating: customers?.filter(c => c.status === 'negotiating').length || 0,
    won: customers?.filter(c => c.status === 'won').length || 0,
    lost: customers?.filter(c => c.status === 'lost').length || 0,
  }

  return (
    <DashboardClient
      companyName={companyName}
      stats={{
        totalProducts,
        totalCustomers,
        totalQuotations,
        customersByStatus,
      }}
      recentQuotations={recentQuotations || []}
    />
  )
}