import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()

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
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
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
      bank_name,
      bank_account,
      bank_swift,
      bank_beneficiary,
    } = body

    // Upsert – insert or update based on user_id
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
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
          bank_name,
          bank_account,
          bank_swift,
          bank_beneficiary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
