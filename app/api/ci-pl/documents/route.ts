import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('ci_pl_documents')
      .select('id, title, currency, source, reference_number, quotation_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ documents: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      title,
      currency,
      customer_name,
      customer_contact,
      customer_address,
      customer_phone,
      container_notes,
      quote_mode,
      source,
      quotation_id,
      products,
      reference_number,
      port_of_loading,
      port_of_discharge,
      vessel_voyage,
      container_number,
      seal_number,
      trade_term,
      payment_terms,
    } = body

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: 'products 为必填数组' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('ci_pl_documents')
      .insert({
        user_id: user.id,
        title: title?.trim() || null,
        currency: currency || 'USD',
        customer_name: customer_name?.trim() || null,
        customer_contact: customer_contact?.trim() || null,
        customer_address: customer_address?.trim() || null,
        customer_phone: customer_phone?.trim() || null,
        container_notes: container_notes?.trim() || null,
        port_of_loading: port_of_loading?.trim() || null,
        port_of_discharge: port_of_discharge?.trim() || null,
        vessel_voyage: vessel_voyage?.trim() || null,
        container_number: container_number?.trim() || null,
        seal_number: seal_number?.trim() || null,
        trade_term: trade_term?.trim() || null,
        payment_terms: payment_terms?.trim() || null,
        quote_mode:
          quote_mode === 'container_group' || quote_mode === 'product_list'
            ? quote_mode
            : 'product_list',
        source: source?.trim() || null,
        quotation_id: quotation_id || null,
        reference_number: reference_number?.trim() || null,
        products,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
