import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/api-auth'
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { emailText } = body

    if (!emailText || typeof emailText !== 'string' || emailText.trim().length === 0) {
      return NextResponse.json({ error: '请提供询盘邮件内容' }, { status: 400 })
    }

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an assistant helping a Chinese SOHO exporter analyze customer inquiry emails. Extract key information from the email and return a JSON object.

Return ONLY a valid JSON object with these fields (use null for fields that cannot be determined):
{
  "product_name": string | null,
  "quantity": number | null,
  "unit": string | null,
  "specs": string | null,
  "trade_term": string | null,
  "destination": string | null,
  "payment_terms": string | null,
  "delivery_deadline": string | null,
  "notes": string | null,
  "raw_summary": string
}

Rules:
- product_name: the main product being inquired about
- quantity: numeric quantity only
- unit: unit of measure (pcs, sets, kg, tons, etc.)
- specs: technical specifications, model numbers, or requirements
- trade_term: shipping term (FOB, CIF, EXW, etc.) if mentioned
- destination: destination port or country
- payment_terms: payment method/terms (T/T, L/C, etc.)
- delivery_deadline: requested delivery date or timeframe
- notes: any other important details
- raw_summary: a 1-2 sentence summary of the inquiry in Chinese
- Return ONLY valid JSON, no markdown fences, no explanations`,
        },
        {
          role: 'user',
          content: emailText,
        },
      ],
      temperature: 0.1,
    })

    const rawContent = completion.choices[0]?.message?.content || ''

    let parsed: Record<string, unknown>
    try {
      // Strip markdown code fences if present
      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'AI 返回格式错误，请重试', raw: rawContent },
        { status: 500 }
      )
    }

    return NextResponse.json(parsed)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
