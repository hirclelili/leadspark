import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/api-auth'
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek'

/**
 * Fallback: user pastes messy table text (from Excel / email) and we extract line items.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const rawText = typeof body.rawText === 'string' ? body.rawText : ''

    if (rawText.trim().length < 3) {
      return NextResponse.json({ error: '请粘贴装箱单或表格文本' }, { status: 400 })
    }

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: `You extract packing list line items from messy text or pasted spreadsheet content for an exporter.
Return ONLY valid JSON (no markdown) with this shape:
{
  "rows": [
    {
      "name": string,
      "model": string,
      "specs": string,
      "qty": number,
      "unit": string,
      "unit_price_foreign": number
    }
  ]
}
Rules:
- name: product / goods description (required)
- qty: parse as number, default 1 if unknown
- unit: default "pc" if unknown
- unit_price_foreign: use 0 if no price in text
- model/specs: optional details from text
- Skip empty lines and header-only rows
- If the text is unreadable, return { "rows": [] }`,
        },
        { role: 'user', content: rawText.slice(0, 32000) },
      ],
      temperature: 0.1,
    })

    const rawContent = completion.choices[0]?.message?.content || ''
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let parsed: { rows?: unknown[] }
    try {
      parsed = JSON.parse(cleaned) as { rows?: unknown[] }
    } catch {
      return NextResponse.json(
        { error: 'AI 返回格式错误', raw: rawContent },
        { status: 500 }
      )
    }

    const rows = Array.isArray(parsed.rows) ? parsed.rows : []
    const normalized = rows
      .map((r) => {
        const o = r as Record<string, unknown>
        const name = String(o.name ?? '').trim()
        if (!name) return null
        const qty = Math.max(1, Number(o.qty) || 1)
        return {
          name,
          model: String(o.model ?? '').trim(),
          specs: String(o.specs ?? '').trim(),
          qty,
          unit: String(o.unit ?? 'pc').trim() || 'pc',
          unit_price_foreign: Math.max(0, Number(o.unit_price_foreign) || 0),
        }
      })
      .filter(Boolean)
      .slice(0, 500)

    return NextResponse.json({ rows: normalized })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
