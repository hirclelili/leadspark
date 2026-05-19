import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

interface ImportRow {
  company_name: string
  contact_name?: string
  email?: string
  phone?: string
  country?: string
  address?: string
  status?: string
  notes?: string
}

const VALID_STATUSES = ['new', 'quoted', 'negotiating', 'won', 'lost']

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const rows: ImportRow[] = body.customers

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '没有可导入的数据' }, { status: 400 })
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: '单次最多导入 500 条' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const records = rows
      .filter((r) => r.company_name?.trim())
      .map((r) => ({
        user_id: user.id,
        company_name: r.company_name.trim(),
        contact_name: r.contact_name?.trim() || null,
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        country: r.country?.trim() || null,
        address: r.address?.trim() || null,
        status: VALID_STATUSES.includes(r.status || '') ? r.status! : 'new',
        notes: r.notes?.trim() || null,
      }))

    if (records.length === 0) {
      return NextResponse.json({ error: '所有行均缺少公司名称，无法导入' }, { status: 400 })
    }

    // Batch insert in chunks of 100 to avoid request size limits
    const chunkSize = 100
    let imported = 0
    const errors: string[] = []

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize)
      const { error, data } = await supabase
        .from('customers')
        .insert(chunk)
        .select('id')

      if (error) {
        errors.push(`第 ${i + 1}–${i + chunk.length} 行：${error.message}`)
      } else {
        imported += data?.length || chunk.length
      }
    }

    return NextResponse.json({
      imported,
      skipped: rows.length - records.length,
      errors,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
