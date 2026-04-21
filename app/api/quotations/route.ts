import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'
import { getNextDocNumber, docKindToType } from '@/lib/docNumber'

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const date_from = searchParams.get('date_from') || ''
    const date_to = searchParams.get('date_to') || ''

    let query = supabase
      .from('quotations')
      .select('*, customers(company_name)', { count: 'exact' })
      .eq('user_id', user.id)

    // Search by quotation number
    if (search) {
      // First find customers matching the search term
      const { data: matchingCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .ilike('company_name', `%${search}%`)

      const customerIds = (matchingCustomers || []).map((c: { id: string }) => c.id)

      if (customerIds.length > 0) {
        query = query.or(
          `quotation_number.ilike.%${search}%,customer_id.in.(${customerIds.join(',')})`
        )
      } else {
        query = query.ilike('quotation_number', `%${search}%`)
      }
    }

    if (status) query = query.eq('status', status)
    if (date_from) query = query.gte('created_at', date_from)
    if (date_to) query = query.lte('created_at', date_to + 'T23:59:59Z')

    const { data, error, count } = await query
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
      document_kind,
      reference_number,
      seller_visible_pl,
      seller_visible_pi,
      seller_visible_ci,
      po_number,
      deposit_percent,
      quote_mode,
      quote_snapshot,
    } = body

    if (!customer_id || !trade_term || !products || products.length === 0) {
      return NextResponse.json({ error: '客户、贸易术语和产品为必填' }, { status: 400 })
    }

    const docType = docKindToType(document_kind)
    const quotation_number = await getNextDocNumber(user.id, docType)

    const baseInsert = {
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
      document_kind: document_kind || 'PI',
      reference_number: reference_number || null,
      seller_visible_pl: seller_visible_pl !== false,
      seller_visible_pi: seller_visible_pi !== false,
      seller_visible_ci: seller_visible_ci !== false,
      po_number: po_number?.trim() || null,
      deposit_percent:
        deposit_percent != null && deposit_percent !== ''
          ? Number(deposit_percent)
          : null,
    }

    // Try with all optional columns first; fall back to base if column missing
    let data: Record<string, unknown> | null = null
    let error: { message: string; code?: string } | null = null

    ;({ data, error } = await supabase
      .from('quotations')
      .insert({
        ...baseInsert,
        quote_mode:
          quote_mode === 'container_group' || quote_mode === 'product_list'
            ? quote_mode
            : 'product_list',
        quote_snapshot: quote_snapshot ?? null,
      })
      .select()
      .single())

    // If column doesn't exist yet (migration not run), retry without optional columns
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      ;({ data, error } = await supabase
        .from('quotations')
        .insert(baseInsert)
        .select()
        .single())
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
