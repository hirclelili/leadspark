import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/api-auth'
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek'

interface QuotationInput {
  quotation_number?: string
  trade_term: string
  currency: string
  products: Array<{
    name: string
    quantity: number
    unit: string
    unit_price: number
  }>
  total_amount_foreign: number
  payment_terms?: string
  delivery_time?: string
  validity_days?: number
}

interface RequestBody {
  quotation: QuotationInput
  customer: {
    company_name: string
    contact_name?: string
  }
  company_name: string
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: RequestBody = await request.json()
    const { quotation, customer, company_name } = body

    if (!quotation || !customer || !company_name) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const productsText = (quotation.products || [])
      .map(
        (p) =>
          `- ${p.name}: ${p.quantity} ${p.unit} @ ${quotation.currency} ${p.unit_price}/${p.unit}`
      )
      .join('\n')

    const prompt = `Generate a professional English quotation reply email for an export business.

Seller company: ${company_name}
Buyer company: ${customer.company_name}
Buyer contact: ${customer.contact_name || 'Sir/Madam'}
Quotation number: ${quotation.quotation_number || 'N/A'}
Trade term: ${quotation.trade_term}
Currency: ${quotation.currency}
Products:
${productsText}
Total amount: ${quotation.currency} ${quotation.total_amount_foreign}
Payment terms: ${quotation.payment_terms || 'T/T 30% deposit, 70% before shipment'}
Delivery time: ${quotation.delivery_time || 'To be confirmed'}
Validity: ${quotation.validity_days || 30} days

Return ONLY a valid JSON object:
{
  "email_subject": string,
  "email_body": string
}

The email should be:
- Professional and courteous
- Include all quotation details clearly formatted
- Mention validity period
- End with a call to action
- Use proper business email format with greeting and sign-off
- The email_body should use \\n for line breaks
Return ONLY valid JSON, no markdown fences.`

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced export sales professional. Generate professional English business emails for quotations. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    const rawContent = completion.choices[0]?.message?.content || ''

    let parsed: { email_subject: string; email_body: string }
    try {
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
