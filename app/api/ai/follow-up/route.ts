import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek'

export type FollowUpType = 'quote_expiry' | 'no_reply' | 'payment_reminder' | 'general'

const FOLLOW_UP_DESCRIPTIONS: Record<FollowUpType, string> = {
  quote_expiry: 'The quotation is expiring soon. Remind the buyer to make a decision before the validity period ends, and express willingness to extend if needed.',
  no_reply: 'The buyer has not responded to the quotation for an extended period. Write a gentle, polite check-in to re-engage.',
  payment_reminder: 'The deposit or payment has not been received yet. Write a friendly but clear payment reminder.',
  general: 'Write a general relationship-maintenance follow-up to keep in touch and check if the buyer has any questions or new requirements.',
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { quotation_id, follow_up_type = 'general' } = body as {
      quotation_id: string
      follow_up_type?: FollowUpType
    }

    if (!quotation_id) {
      return NextResponse.json({ error: 'quotation_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch quotation + customer in parallel with user profile
    const [quotationResult, profileResult] = await Promise.all([
      supabase
        .from('quotations')
        .select('*, customers(id, company_name, contact_name, email, address, phone)')
        .eq('id', quotation_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_profiles')
        .select('company_name, phone, email, website, address')
        .eq('user_id', user.id)
        .single(),
    ])

    if (quotationResult.error || !quotationResult.data) {
      return NextResponse.json({ error: '报价单不存在' }, { status: 404 })
    }

    const quotation = quotationResult.data
    const profile = profileResult.data
    const customer = quotation.customers as any

    // Fetch recent customer remarks (if we have a customer)
    let remarksText = ''
    if (customer?.id) {
      const { data: remarks } = await supabase
        .from('customer_remarks')
        .select('content, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (remarks && remarks.length > 0) {
        remarksText = remarks
          .map((r: any) => `- ${r.content}`)
          .join('\n')
      }
    }

    // Build products summary
    const products = (quotation.products || []) as any[]
    const productsSummary = products
      .map((p: any) => `${p.name}${p.model ? ` (${p.model})` : ''}: ${p.qty} ${p.unit || 'pc'} @ ${quotation.currency} ${p.unit_price_foreign}`)
      .join(', ')

    // Days since quotation was created
    const daysSince = Math.floor(
      (Date.now() - new Date(quotation.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Build company signature
    const senderCompany = profile?.company_name || 'Our Company'
    const signatureParts = [senderCompany]
    if (profile?.phone) signatureParts.push(`Tel: ${profile.phone}`)
    if (profile?.email) signatureParts.push(`Email: ${profile.email}`)
    if (profile?.website) signatureParts.push(profile.website)
    const signature = signatureParts.join(' | ')

    const followUpDescription = FOLLOW_UP_DESCRIPTIONS[follow_up_type as FollowUpType] || FOLLOW_UP_DESCRIPTIONS.general

    const prompt = `You are an experienced export sales professional writing a follow-up email on behalf of ${senderCompany}.

CONTEXT:
- Buyer company: ${customer?.company_name || 'the buyer'}
- Buyer contact: ${customer?.contact_name || 'Sir/Madam'}
- Quotation number: ${quotation.quotation_number}
- Products: ${productsSummary || 'as per quotation'}
- Total amount: ${quotation.currency} ${quotation.total_amount_foreign}
- Trade term: ${quotation.trade_term}
- Payment terms: ${quotation.payment_terms || 'T/T'}
- Validity: ${quotation.validity_days || 30} days
- Quotation was sent: ${daysSince} days ago
${remarksText ? `\nNotes about this customer:\n${remarksText}` : ''}

TASK: ${followUpDescription}

REQUIRED EMAIL STRUCTURE:
1. Professional greeting (use contact name if available)
2. Brief reference to quotation number ${quotation.quotation_number}
3. Concise, warm message body (2-3 sentences max — get to the point)
4. Clear call to action (e.g., "Please let us know if you have any questions.")
5. Professional sign-off:
   Best regards,
   [your name if known, otherwise leave blank]
   ${signature}

RULES:
- Do NOT use placeholder text like [Your Name] or [Company Name] — use the actual data above
- Keep the email under 200 words
- Warm but professional tone
- Output ONLY valid JSON: { "subject": "...", "body": "..." }
- Use \\n for line breaks in body
- Return ONLY the JSON, no markdown fences`

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert export sales email writer. Output only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    })

    const rawContent = completion.choices[0]?.message?.content || ''

    let parsed: { subject: string; body: string }
    try {
      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'AI 返回格式错误，请重试', raw: rawContent }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
