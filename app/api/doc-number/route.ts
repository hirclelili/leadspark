import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'
import type { DocNumberConfig, YearFormat } from '@/lib/docNumber'

export type { DocNumberConfig, YearFormat }

const DEFAULTS: DocNumberConfig[] = ['Q', 'PI', 'CI'].map(doc_type => ({
  doc_type: doc_type as DocNumberConfig['doc_type'],
  prefix: doc_type,
  year_format: 'YYYY' as YearFormat,
  digits: 3,
  reset_yearly: true,
  current_year: 0,
  current_seq: 0,
}))

// GET /api/doc-number — list all sequences for current user
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('doc_number_sequences')
      .select('*')
      .eq('user_id', user.id)
      .order('doc_type')

    if (error) {
      // Table may not be migrated yet — return defaults
      if (error.code === '42P01') return NextResponse.json(DEFAULTS)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const existing = new Set((data || []).map((r: any) => r.doc_type))
    const merged = [
      ...(data || []),
      ...DEFAULTS.filter(d => !existing.has(d.doc_type)),
    ]
    return NextResponse.json(merged)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/doc-number — upsert config (does NOT advance seq)
export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { doc_type, prefix, year_format, digits, reset_yearly } = body
    if (!doc_type) return NextResponse.json({ error: 'doc_type required' }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('doc_number_sequences')
      .upsert({
        user_id: user.id,
        doc_type,
        prefix: prefix ?? doc_type,
        year_format: year_format ?? 'YYYY',
        digits: Math.max(2, Math.min(5, Number(digits) || 3)),
        reset_yearly: reset_yearly !== false,
      }, { onConflict: 'user_id,doc_type' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/doc-number — reset seq to 0 for a doc type
export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { doc_type } = await request.json()
    if (!doc_type) return NextResponse.json({ error: 'doc_type required' }, { status: 400 })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('doc_number_sequences')
      .update({ current_seq: 0, current_year: 0 })
      .eq('user_id', user.id)
      .eq('doc_type', doc_type)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
