import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || null)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      company_name,
      company_name_cn,
      logo_url,
      address,
      phone,
      email,
      website,
      default_currency,
      default_payment_terms,
      default_validity,
    } = body

    // Check if profile exists
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result
    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          company_name,
          company_name_cn,
          logo_url,
          address,
          phone,
          email,
          website,
          default_currency,
          default_payment_terms,
          default_validity,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    } else {
      // Insert
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          company_name,
          company_name_cn,
          logo_url,
          address,
          phone,
          email,
          website,
          default_currency: default_currency || 'USD',
          default_payment_terms: default_payment_terms || 'T/T 30% deposit, 70% before shipment',
          default_validity: default_validity || 30,
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}