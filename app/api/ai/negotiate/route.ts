import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/api-auth'
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      customer_message,
      product_name,
      quoted_price,
      currency,
      min_price,
      context,
    } = body

    if (!customer_message || !product_name || !quoted_price || !currency) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const minPriceInfo = min_price
      ? `Our minimum acceptable price is ${currency} ${min_price}. Do not go below this in any scenario.`
      : 'No hard floor price specified, but try to maintain pricing as close to the quoted price as possible.'

    const contextInfo = context ? `Additional context: ${context}` : ''

    const prompt = `You are helping a Chinese exporter respond to a customer's price negotiation message.

Product: ${product_name}
Our quoted price: ${currency} ${quoted_price}
${minPriceInfo}
${contextInfo}

Customer's message:
"${customer_message}"

Write a professional, tactful English email response that:
1. Acknowledges the customer's concern
2. Maintains a positive and cooperative tone
3. Explains or justifies the pricing (quality, costs, market conditions) without being defensive
4. Offers a small concession if appropriate (but never below the minimum price if specified)
5. Suggests value-adds instead of pure price cuts (better payment terms, faster delivery, smaller MOQ, etc.)
6. Keeps the door open for further discussion
7. Ends with a clear call to action

Write only the email body text (no subject line needed). Use \\n for line breaks. Be natural and professional, not robotic.`

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced export sales professional skilled in negotiation. Write tactful, professional English business emails that maintain good customer relationships while protecting margins.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content || ''

    return NextResponse.json({ reply })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
