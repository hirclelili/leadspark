import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'
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
    id?: string
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

    const supabase = createAdminClient()

    // Fetch user profile for signature info + optional customer remarks in parallel
    const [profileResult, remarksResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('company_name, phone, email, website, address')
        .eq('user_id', user.id)
        .single(),
      customer.id
        ? supabase
            .from('customer_remarks')
            .select('content, created_at')
            .eq('customer_id', customer.id)
            .order('created_at', { ascending: false })
            .limit(3)
        : Promise.resolve({ data: null }),
    ])

    const profile = profileResult.data
    const remarks = remarksResult.data

    // Build company signature
    const senderCompany = profile?.company_name || company_name
    const signatureParts: string[] = []
    if (profile?.phone) signatureParts.push(`Tel: ${profile.phone}`)
    if (profile?.email) signatureParts.push(`Email: ${profile.email}`)
    if (profile?.website) signatureParts.push(profile.website)
    const contactLine = signatureParts.join(' | ')

    // Build products table text
    const productsText = (quotation.products || [])
      .map(
        (p) =>
          `- ${p.name}: ${p.quantity} ${p.unit} @ ${quotation.currency} ${p.unit_price}/${p.unit}`
      )
      .join('\n')

    // Build optional customer background
    let customerBackground = ''
    if (remarks && remarks.length > 0) {
      customerBackground = `\nBackground notes on this customer:\n${(remarks as any[]).map((r: any) => `- ${r.content}`).join('\n')}`
    }

    const prompt = `Write a professional English quotation reply email.

SELLER: ${senderCompany}
BUYER: ${customer.company_name}
CONTACT: ${customer.contact_name || 'Sir/Madam'}
QUOTATION NO.: ${quotation.quotation_number || 'N/A'}
TRADE TERM: ${quotation.trade_term}
CURRENCY: ${quotation.currency}
PRODUCTS:
${productsText}
TOTAL: ${quotation.currency} ${quotation.total_amount_foreign}
PAYMENT: ${quotation.payment_terms || 'T/T 30% deposit, 70% before shipment'}
DELIVERY: ${quotation.delivery_time || 'To be confirmed'}
VALIDITY: ${quotation.validity_days || 30} days from today
${customerBackground}

REQUIRED EMAIL STRUCTURE (5 parts):
1. Opening: Warm greeting + thank them for their inquiry/interest
2. Quotation reference: Mention quotation number and trade term
3. Product summary: Brief confirmation of key items (do NOT repeat the full table — one sentence)
4. Terms: Payment terms, delivery time, and validity period
5. Sign-off:
   Best regards,
   ${senderCompany}
   ${contactLine}

RULES:
- Professional and warm, under 250 words
- Do NOT use any placeholder text like [Your Name] or brackets — use the actual data
- Output ONLY valid JSON: { "email_subject": "...", "email_body": "..." }
- Use \\n for line breaks
- Return ONLY JSON, no markdown fences`

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
      temperature: 0.4,
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
