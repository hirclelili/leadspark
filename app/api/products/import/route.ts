import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Preview Excel file
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 })
    }

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json({ error: '仅支持 .xlsx 和 .csv 文件' }, { status: 400 })
    }

    // Read file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    if (data.length === 0) {
      return NextResponse.json({ error: '文件为空' }, { status: 400 })
    }

    // Validate and parse data
    const products = []
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, any>
      const rowIndex = i + 2
      const name = row['产品名称'] || row['name'] || row['Name']
      const model = row['型号'] || row['model'] || row['Model'] || ''
      const cost_price = parseFloat(row['成本价'] || row['cost_price'] || row['Cost Price'] || row['cost'])
      const unit = row['单位'] || row['unit'] || row['Unit'] || 'pc'
      const specs = row['规格'] || row['specs'] || row['Specs'] || ''
      const category = row['分类'] || row['category'] || row['Category'] || ''

      if (!name) {
        errors.push(`第 ${rowIndex} 行：产品名称不能为空`)
        continue
      }
      if (!cost_price || isNaN(cost_price)) {
        errors.push(`第 ${rowIndex} 行：成本价无效`)
        continue
      }

      products.push({
        name,
        model,
        cost_price,
        unit,
        specs,
        category,
      })
    }

    return NextResponse.json({
      products: products.slice(0, 100), // Limit preview to 100
      total: products.length,
      errors,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Import products with confirmation
export async function PUT(request: Request) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { products } = body

    if (!products || products.length === 0) {
      return NextResponse.json({ error: '没有数据' }, { status: 400 })
    }

    // Add user_id to all products
    const productsWithUser = products.map((p: any) => ({
      ...p,
      user_id: user.id,
    }))

    // Insert all products
    const { data: inserted, error } = await supabase
      .from('products')
      .insert(productsWithUser)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      inserted: inserted?.length || 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}