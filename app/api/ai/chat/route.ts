import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { messages } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少消息内容' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch company profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_name, company_name_cn, address, phone, email, default_payment_terms')
      .eq('user_id', user.id)
      .single()

    // Fetch top 20 products for context
    const { data: products } = await supabase
      .from('products')
      .select('name, model, cost_price, unit, specs')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const companyName = profile?.company_name || 'our company'
    const productList = (products || [])
      .map((p) => `- ${p.name}${p.model ? ` (${p.model})` : ''}: ¥${p.cost_price}/${p.unit || 'pc'}${p.specs ? `, ${p.specs}` : ''}`)
      .join('\n')

    const systemPrompt = `You are an expert foreign trade sales assistant for ${companyName}${profile?.company_name_cn ? ` (${profile.company_name_cn})` : ''}.

Company information:
- Name: ${companyName}
${profile?.address ? `- Address: ${profile.address}` : ''}
${profile?.phone ? `- Phone: ${profile.phone}` : ''}
${profile?.email ? `- Email: ${profile.email}` : ''}
${profile?.default_payment_terms ? `- Default payment terms: ${profile.default_payment_terms}` : ''}

Product catalog (${(products || []).length} products):
${productList || 'No products loaded yet.'}

Your capabilities:
1. Parse customer inquiry emails and extract key information
2. Draft professional English quotation reply emails
3. Help with price negotiation responses
4. Advise on trade terms (Incoterms), payment methods, and export logistics
5. Calculate or estimate pricing based on cost + margin

Always respond in Chinese unless the user explicitly asks for English content or you are drafting an English email.
Be practical, concise, and focused on helping close deals.`

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const reply = completion.choices[0]?.message?.content || ''
    return NextResponse.json({ reply })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
