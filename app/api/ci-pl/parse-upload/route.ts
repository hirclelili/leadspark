import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAuthUser } from '@/lib/supabase/api-auth'
import { rowObjectToParsed } from '@/lib/packingExcelParse'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '请上传文件' }, { status: 400 })

    const allowed =
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'text/csv' ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')

    if (!allowed) {
      return NextResponse.json({ error: '仅支持 .xlsx / .xls / .csv' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    const parsed: ReturnType<typeof rowObjectToParsed>[] = []
    const warnings: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const line = rowObjectToParsed(row)
      if (!line) continue
      parsed.push(line)
      if (parsed.length >= 500) {
        warnings.push('已截断至前 500 行')
        break
      }
    }

    if (parsed.length === 0) {
      return NextResponse.json({
        rows: [],
        warnings: [
          ...warnings,
          '未识别到有效数据行，请检查表头是否包含 Description / 品名 / Qty 等列，或使用粘贴 + AI 解析。',
        ],
      })
    }

    return NextResponse.json({ rows: parsed, warnings })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '解析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
