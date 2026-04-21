import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')

    const today = new Date().toISOString().split('T')[0]

    // Count overdue tasks (always included in response)
    const { count: overdueCount } = await supabase
      .from('follow_up_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('completed_at', null)
      .lt('due_date', today)

    let query = supabase
      .from('follow_up_tasks')
      .select(
        'id, user_id, title, due_date, note, completed_at, quotation_id, customer_id, created_at, updated_at, customers(company_name), quotations(quotation_number)',
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .range((page - 1) * limit, page * limit - 1)

    if (status === 'pending') {
      query = query.is('completed_at', null).order('due_date', { ascending: true })
    } else if (status === 'completed') {
      query = query.not('completed_at', 'is', null).order('completed_at', { ascending: false })
    } else if (status === 'overdue') {
      query = query
        .is('completed_at', null)
        .lt('due_date', today)
        .order('due_date', { ascending: true })
    } else {
      // all
      query = query.order('due_date', { ascending: true })
    }

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      tasks: data || [],
      total: count || 0,
      overdue_count: overdueCount || 0,
    })
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
    const { title, due_date, note, quotation_id, customer_id } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: '标题为必填' }, { status: 400 })
    }
    if (!due_date) {
      return NextResponse.json({ error: '截止日期为必填' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('follow_up_tasks')
      .insert({
        user_id: user.id,
        title: title.trim(),
        due_date,
        note: note || null,
        quotation_id: quotation_id || null,
        customer_id: customer_id || null,
      })
      .select(
        'id, user_id, title, due_date, note, completed_at, quotation_id, customer_id, created_at, updated_at, customers(company_name), quotations(quotation_number)'
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
