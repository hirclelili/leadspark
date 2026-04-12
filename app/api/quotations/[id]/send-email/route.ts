import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'

function buildEmailHTML(quotation: any, profile: any): string {
  const sym: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', AED: 'AED ', SGD: 'S$',
  }
  const currency = quotation.currency || 'USD'
  const s = sym[currency] || currency + ' '
  const fmt = (n: number) => `${s}${n.toFixed(2)}`

  const productRows = (quotation.products || [])
    .map((p: any, i: number) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px 12px; color: #374151;">${i + 1}</td>
        <td style="padding: 8px 12px; color: #374151;">
          ${p.name}${p.model ? ` (${p.model})` : ''}${p.specs ? `<br><span style="font-size:12px;color:#6b7280;">${p.specs}</span>` : ''}
        </td>
        <td style="padding: 8px 12px; text-align: right; color: #374151;">${p.qty} ${p.unit}</td>
        <td style="padding: 8px 12px; text-align: right; color: #374151; font-family: monospace;">${fmt(p.unit_price_foreign || 0)}</td>
        <td style="padding: 8px 12px; text-align: right; color: #374151; font-family: monospace; font-weight: 600;">${fmt(p.amount_foreign || 0)}</td>
      </tr>`)
    .join('')

  const bankSection = (profile?.bank_name || profile?.bank_account) ? `
    <div style="margin-top: 24px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
      <p style="margin: 0 0 10px; font-weight: 600; color: #111827;">Banking Information:</p>
      ${profile.bank_beneficiary ? `<p style="margin: 4px 0; color: #374151;"><span style="color: #6b7280; width: 120px; display: inline-block;">Beneficiary:</span>${profile.bank_beneficiary}</p>` : ''}
      ${profile.bank_name ? `<p style="margin: 4px 0; color: #374151;"><span style="color: #6b7280; width: 120px; display: inline-block;">Bank Name:</span>${profile.bank_name}</p>` : ''}
      ${profile.bank_account ? `<p style="margin: 4px 0; color: #374151;"><span style="color: #6b7280; width: 120px; display: inline-block;">Account No.:</span>${profile.bank_account}</p>` : ''}
      ${profile.bank_swift ? `<p style="margin: 4px 0; color: #374151;"><span style="color: #6b7280; width: 120px; display: inline-block;">SWIFT/BIC:</span>${profile.bank_swift}</p>` : ''}
    </div>` : ''

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; color: #111827; max-width: 700px; margin: 0 auto; padding: 24px;">
      <!-- Header -->
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 22px; color: #111827;">${profile?.company_name || 'Our Company'}</h1>
          ${profile?.company_name_cn ? `<p style="margin: 2px 0; color: #6b7280; font-size: 13px;">${profile.company_name_cn}</p>` : ''}
          ${profile?.address ? `<p style="margin: 2px 0; color: #6b7280; font-size: 13px;">${profile.address}</p>` : ''}
          ${profile?.email ? `<p style="margin: 2px 0; color: #6b7280; font-size: 13px;">${profile.email}</p>` : ''}
          ${profile?.phone ? `<p style="margin: 2px 0; color: #6b7280; font-size: 13px;">${profile.phone}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; font-size: 20px; color: #3b82f6;">QUOTATION</h2>
          <p style="margin: 4px 0; color: #6b7280; font-size: 13px;">No: ${quotation.quotation_number}</p>
          <p style="margin: 4px 0; color: #6b7280; font-size: 13px;">Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <!-- To -->
      <div style="background: #f3f4f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #6b7280;">To:</p>
        <p style="margin: 4px 0 0; font-weight: 600; color: #111827;">${quotation.customers?.company_name || ''}</p>
        ${quotation.customers?.contact_name ? `<p style="margin: 2px 0; color: #374151; font-size: 13px;">${quotation.customers.contact_name}</p>` : ''}
      </div>

      <!-- Details -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; width: 120px;">Trade Term:</td>
          <td style="padding: 4px 0; font-weight: 600; color: #374151;">${quotation.trade_term}</td>
          <td style="padding: 4px 0; color: #6b7280; width: 120px;">Valid for:</td>
          <td style="padding: 4px 0; color: #374151;">${quotation.validity_days || 30} days</td>
        </tr>
      </table>

      <!-- Products table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 1px solid #ddd;">
            <th style="padding: 10px 12px; text-align: left; color: #374151; font-size: 12px; width: 30px;">No.</th>
            <th style="padding: 10px 12px; text-align: left; color: #374151; font-size: 12px;">Product / Description</th>
            <th style="padding: 10px 12px; text-align: right; color: #374151; font-size: 12px;">Qty</th>
            <th style="padding: 10px 12px; text-align: right; color: #374151; font-size: 12px;">Unit Price</th>
            <th style="padding: 10px 12px; text-align: right; color: #374151; font-size: 12px;">Amount</th>
          </tr>
        </thead>
        <tbody>${productRows}</tbody>
        <tfoot>
          <tr style="background: #eff6ff;">
            <td colspan="4" style="padding: 10px 12px; text-align: right; font-weight: 700; color: #1d4ed8;">Total:</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #1d4ed8; font-family: monospace; font-size: 14px;">${fmt(quotation.total_amount_foreign || 0)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Terms -->
      <table style="width: 100%; font-size: 13px; margin-bottom: 8px;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; width: 130px;">Payment Terms:</td>
          <td style="color: #374151;">${quotation.payment_terms || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Delivery Time:</td>
          <td style="color: #374151;">${quotation.delivery_time || '—'}</td>
        </tr>
        ${quotation.packing ? `<tr><td style="padding: 4px 0; color: #6b7280;">Packing:</td><td style="color: #374151;">${quotation.packing}</td></tr>` : ''}
        ${quotation.remarks ? `<tr><td style="padding: 4px 0; color: #6b7280; vertical-align: top;">Remarks:</td><td style="color: #374151; white-space: pre-wrap;">${quotation.remarks}</td></tr>` : ''}
      </table>

      ${bankSection}

      <!-- Footer -->
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">This quotation is valid for ${quotation.validity_days || 30} days from the date above.</p>
        <p style="margin: 4px 0;">Please do not hesitate to contact us if you have any questions.</p>
        ${profile?.email ? `<p style="margin: 4px 0;">${profile.email}${profile?.phone ? ` · ${profile.phone}` : ''}</p>` : ''}
      </div>
    </body>
    </html>
  `
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()

    // Fetch quotation with customer
    const { data: quotation, error: qErr } = await supabase
      .from('quotations')
      .select('*, customers(company_name, contact_name, email)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (qErr || !quotation) {
      return NextResponse.json({ error: '报价单不存在' }, { status: 404 })
    }

    const customerEmail = quotation.customers?.email
    if (!customerEmail) {
      return NextResponse.json({ error: '客户邮箱未填写，无法发送' }, { status: 400 })
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: '未配置 RESEND_API_KEY，请在环境变量中设置' }, { status: 500 })
    }

    const resend = new Resend(apiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const companyName = profile?.company_name || 'Our Company'

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `Quotation ${quotation.quotation_number} from ${companyName}`,
      html: buildEmailHTML(quotation, profile),
    })

    if (sendError) {
      return NextResponse.json({ error: sendError.message || '邮件发送失败' }, { status: 500 })
    }

    // Update quotation status to sent
    await supabase
      .from('quotations')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    // Add customer remark
    if (quotation.customer_id) {
      const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
      await supabase
        .from('customer_remarks')
        .insert({
          customer_id: quotation.customer_id,
          user_id: user.id,
          content: `报价单 ${quotation.quotation_number} 已于 ${date} 发送至 ${customerEmail}`,
        })
    }

    return NextResponse.json({ success: true, to: customerEmail })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
