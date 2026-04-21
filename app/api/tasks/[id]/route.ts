import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()
    const body = await request.json()

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if ('title' in body) updates.title = body.title
    if ('due_date' in body) updates.due_date = body.due_date
    if ('note' in body) updates.note = body.note

    if ('complete' in body) {
      updates.completed_at = body.complete ? new Date().toISOString() : null
    } else if ('completed_at' in body) {
      updates.completed_at = body.completed_at
    }

    const { data, error } = await supabase
      .from('follow_up_tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
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
      .from('follow_up_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
