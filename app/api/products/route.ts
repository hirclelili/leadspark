import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,model.ilike.%${search}%`)
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: categories } = await supabase
      .from('products')
      .select('category')
      .eq('user_id', user.id)
      .not('category', 'is', null)

    const uniqueCategories = [...new Set(categories?.map((c) => c.category).filter(Boolean))]

    return NextResponse.json({
      products: data || [],
      total: count || 0,
      page,
      limit,
      categories: uniqueCategories,
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
    const { name, model, cost_price, unit, specs, image_url, category, external_name } = body

    if (!name || !cost_price) {
      return NextResponse.json({ error: '产品名称和成本价为必填' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        user_id: user.id,
        name,
        model,
        cost_price,
        unit: unit || 'pc',
        specs,
        image_url,
        category,
        external_name: external_name || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
