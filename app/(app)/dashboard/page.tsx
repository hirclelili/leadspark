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

  // Chart date range — computed before launching parallel queries
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  sixMonthsAgo.setDate(1)

  // Date range for expiring quotes check
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Run all DB queries in parallel — reduces dashboard TTFB significantly
  const [
    { data: profile },
    { count: totalProducts },
    { data: customers },
    { count: totalQuotations },
    { data: recentQuotations },
    { data: chartQuotations },
    { data: recentQuotationsForInsights },
  ] = await Promise.all([
    supabase.from('user_profiles').select('company_name').eq('user_id', user.id).single(),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('customers').select('status').eq('user_id', user.id),
    supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('quotations').select('*, customers(company_name)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    supabase
      .from('quotations').select('created_at, total_amount_foreign, status')
      .eq('user_id', user.id).gte('created_at', sixMonthsAgo.toISOString()).order('created_at'),
    supabase
      .from('quotations')
      .select('id, quotation_number, validity_days, created_at, status, customers(company_name)')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false }),
  ])

  const companyName = profile?.company_name || ''

  // Compute expiring quotes (validity expires within 5 days)
  const today = new Date()
  const expiringQuotes = (recentQuotationsForInsights || []).filter((q: any) => {
    const validity = q.validity_days || 30
    const created = new Date(q.created_at)
    const expiresAt = new Date(created.getTime() + validity * 24 * 60 * 60 * 1000)
    const daysLeft = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysLeft >= 0 && daysLeft <= 5 && q.status !== 'won' && q.status !== 'lost'
  }).map((q: any) => {
    const validity = q.validity_days || 30
    const created = new Date(q.created_at)
    const expiresAt = new Date(created.getTime() + validity * 24 * 60 * 60 * 1000)
    const daysLeft = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return { ...q, daysLeft }
  })

  // Aggregate monthly totals (USD-equivalent)
  const monthMap: Record<string, number> = {}
  const statusCount: Record<string, number> = {}
  for (const q of chartQuotations || []) {
    const d = new Date(q.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = (monthMap[key] || 0) + (q.total_amount_foreign || 0)
    const s = q.status || 'draft'
    statusCount[s] = (statusCount[s] || 0) + 1
  }

  // Fill in all months even if no data
  const monthlyData: { month: string; total: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    d.setDate(1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getMonth() + 1}月`
    monthlyData.push({ month: label, total: Math.round((monthMap[key] || 0) * 100) / 100 })
  }

  const STATUS_LABELS: Record<string, string> = {
    draft: '草稿', sent: '已发送', negotiating: '议价中', won: '已成交', lost: '已流失',
  }
  const quotesByStatus = Object.entries(statusCount).map(([s, count]) => ({
    name: STATUS_LABELS[s] || s,
    value: count,
  }))

  // Calculate stats
  const totalCustomers = customers?.length || 0
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
        totalProducts: totalProducts ?? 0,
        totalCustomers,
        totalQuotations: totalQuotations ?? 0,
        customersByStatus,
      }}
      recentQuotations={recentQuotations || []}
      monthlyData={monthlyData}
      quotesByStatus={quotesByStatus}
      expiringQuotes={expiringQuotes}
    />
  )
}