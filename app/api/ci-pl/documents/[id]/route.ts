import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('ci_pl_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const keys = [
      'title',
      'currency',
      'customer_name',
      'customer_contact',
      'customer_address',
      'customer_phone',
      'container_notes',
      'quote_mode',
      'source',
      'quotation_id',
      'products',
      'reference_number',
      'port_of_loading',
      'port_of_discharge',
      'vessel_voyage',
      'container_number',
      'seal_number',
      'trade_term',
      'payment_terms',
    ] as const

    for (const k of keys) {
      if (k in body) payload[k] = body[k]
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('ci_pl_documents')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('ci_pl_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
