import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

function generateQuotationNumber(): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `LS-${y}${m}${d}-${random}`
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const { data, error, count } = await supabase
      .from('quotations')
      .select('*, customers(company_name)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ quotations: data || [], total: count || 0, page, limit })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const body = await request.json()
    const {
      customer_id,
      trade_term,
      currency,
      exchange_rate,
      products,
      costs,
      total_amount_foreign,
      total_amount_cny,
      payment_terms,
      delivery_time,
      validity_days,
      packing,
      remarks,
    } = body

    if (!customer_id || !trade_term || !products || products.length === 0) {
      return NextResponse.json({ error: '客户、贸易术语和产品为必填' }, { status: 400 })
    }

    const quotation_number = generateQuotationNumber()

    const { data, error } = await supabase
      .from('quotations')
      .insert({
        user_id: user.id,
        customer_id,
        quotation_number,
        trade_term,
        currency: currency || 'USD',
        exchange_rate,
        products,
        costs,
        total_amount_foreign,
        total_amount_cny,
        payment_terms,
        delivery_time,
        validity_days: validity_days || 30,
        packing,
        remarks,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
