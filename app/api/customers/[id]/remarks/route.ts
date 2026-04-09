import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()
    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: '备注内容不能为空' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('customer_remarks')
      .insert({
        customer_id: id,
        user_id: user.id,
        content: content.trim(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: customerId } = await params
    const { searchParams } = new URL(request.url)
    const remarkId = searchParams.get('remarkId')

    if (!remarkId) {
      return NextResponse.json({ error: '缺少 remarkId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('customer_remarks')
      .delete()
      .eq('id', remarkId)
      .eq('customer_id', customerId)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
