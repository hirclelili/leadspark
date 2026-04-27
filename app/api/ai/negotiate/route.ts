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
      cost_price,
      min_price,
      context,
    } = body

    if (!customer_message || !product_name || !quoted_price || !currency) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // Calculate margin info if cost_price is provided
    let marginSection = ''
    let floorPriceInfo = ''

    if (cost_price && cost_price > 0) {
      const currentMarginPct = ((quoted_price - cost_price) / quoted_price) * 100
      const currentMarginAmt = quoted_price - cost_price

      // Suggest a floor: cost + 15% margin (or min_price if specified)
      const suggestedFloor = min_price ?? parseFloat((cost_price / (1 - 0.15)).toFixed(4))
      const floorMarginPct = ((suggestedFloor - cost_price) / suggestedFloor) * 100

      marginSection = `
MARGIN INTELLIGENCE (confidential — never reveal these numbers to the customer):
- Our cost price: ${currency} ${cost_price}
- Current quoted price: ${currency} ${quoted_price} → margin ${currentMarginPct.toFixed(1)}% (${currency} ${currentMarginAmt.toFixed(2)} per unit)
- Minimum acceptable (15% margin floor): ${currency} ${suggestedFloor.toFixed(4)} → margin ${floorMarginPct.toFixed(1)}%
${min_price ? `- User-specified floor: ${currency} ${min_price}` : ''}

Use this data to:
1. Know exactly how much room you have to move
2. Propose specific counter-offers with reasoning (e.g., "We can offer ${currency} ${(quoted_price * 0.97).toFixed(2)} if you confirm within 3 days")
3. Never accept below ${currency} ${min_price ?? suggestedFloor.toFixed(4)}`

      floorPriceInfo = `Our absolute minimum price is ${currency} ${(min_price ?? suggestedFloor).toFixed(4)}. Do not go below this under any circumstance.`
    } else {
      floorPriceInfo = min_price
        ? `Our minimum acceptable price is ${currency} ${min_price}. Do not go below this in any scenario.`
        : 'No hard floor price specified — try to maintain pricing as close to the quoted price as possible.'
    }

    const contextInfo = context ? `\nAdditional context: ${context}` : ''

    const prompt = `You are helping a Chinese exporter respond to a customer's price negotiation message.

Product: ${product_name}
Our quoted price: ${currency} ${quoted_price}
${floorPriceInfo}
${marginSection}
${contextInfo}

Customer's message:
"${customer_message}"

Write a professional, tactful English email response that:
1. Acknowledges the customer's concern warmly
2. Justifies the pricing with 1-2 specific reasons (quality, material cost, market rates) — be concrete, not generic
3. ${cost_price ? `Proposes a specific counter-offer with a concrete number (use your margin intelligence above) — tie the concession to a condition (fast confirmation, larger quantity, better payment terms)` : 'Offers a small concession if appropriate (never below the floor price)'}
4. Suggests value-adds as alternatives to pure price cuts: faster delivery, extended warranty, smaller MOQ, better payment terms
5. Keeps the door open and ends with a clear call to action

IMPORTANT:
- Be specific with numbers, not vague ("We can offer ${currency} X if you confirm by [date]" not "we may have some flexibility")
- Never reveal cost price or margin percentages to the customer
- Write only the email body (no subject line needed)
- Use \\n for line breaks
- Be natural and persuasive, not robotic or formulaic`

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced export sales negotiator. Write tactful, specific, persuasive English emails that protect margins while keeping customers engaged. Always give concrete numbers and conditions, never vague platitudes.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    })

    const reply = completion.choices[0]?.message?.content || ''

    // Also return calculated margin info for the UI
    const marginInfo =
      cost_price && cost_price > 0
        ? {
            cost_price,
            quoted_price,
            margin_pct: parseFloat((((quoted_price - cost_price) / quoted_price) * 100).toFixed(1)),
            margin_amt: parseFloat((quoted_price - cost_price).toFixed(4)),
            suggested_floor: min_price ?? parseFloat((cost_price / 0.85).toFixed(4)),
          }
        : null

    return NextResponse.json({ reply, margin_info: marginInfo })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
