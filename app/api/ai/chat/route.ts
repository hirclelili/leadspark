import { NextResponse } from 'next/server'
import { getAuthUser, createAdminClient } from '@/lib/supabase/api-auth'
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { messages, customer_id, quotation_id } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少消息内容' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch base context + optional bound context in parallel
    const [profileResult, productsResult, customerResult, quotationResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('company_name, company_name_cn, address, phone, email, website, default_payment_terms')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('products')
        .select('name, model, cost_price, unit, specs')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      customer_id
        ? supabase
            .from('customers')
            .select('company_name, contact_name, email, phone, country, address, status, notes')
            .eq('id', customer_id)
            .eq('user_id', user.id)
            .single()
        : Promise.resolve({ data: null }),
      quotation_id
        ? supabase
            .from('quotations')
            .select('quotation_number, trade_term, currency, exchange_rate, products, costs, total_amount_foreign, payment_terms, delivery_time, validity_days, packing, remarks, document_kind, created_at')
            .eq('id', quotation_id)
            .eq('user_id', user.id)
            .single()
        : Promise.resolve({ data: null }),
    ])

    // Fetch customer remarks if customer is bound
    let remarksData: { content: string }[] = []
    if (customer_id) {
      const { data } = await supabase
        .from('customer_remarks')
        .select('content, created_at')
        .eq('customer_id', customer_id)
        .order('created_at', { ascending: false })
        .limit(5)
      remarksData = data || []
    }

    // Fetch recent quotations for bound customer (if no specific quotation bound)
    let recentQuotations: any[] = []
    if (customer_id && !quotation_id) {
      const { data } = await supabase
        .from('quotations')
        .select('quotation_number, trade_term, currency, total_amount_foreign, created_at, document_kind')
        .eq('customer_id', customer_id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
      recentQuotations = data || []
    }

    const profile = profileResult.data
    const products = productsResult.data || []
    const customer = customerResult.data
    const quotation = quotationResult.data

    const companyName = profile?.company_name || 'our company'

    // Build product catalog text
    const productList = products
      .map((p) => `- ${p.name}${p.model ? ` (${p.model})` : ''}: ¥${p.cost_price}/${p.unit || 'pc'}${p.specs ? `, ${p.specs}` : ''}`)
      .join('\n')

    // Build customer context section
    let customerSection = ''
    if (customer) {
      const statusLabels: Record<string, string> = {
        new: '新客户', quoted: '已报价', negotiating: '谈判中', won: '已成交', lost: '已流失',
      }
      customerSection = `
=== 当前绑定客户 ===
公司名：${customer.company_name}
联系人：${customer.contact_name || '—'}
邮箱：${customer.email || '—'}
电话：${customer.phone || '—'}
国家/地区：${customer.country || '—'}
地址：${customer.address || '—'}
状态：${statusLabels[customer.status] || customer.status || '—'}
${customer.notes ? `备注：${customer.notes}` : ''}
${remarksData.length > 0 ? `\n最近沟通记录：\n${remarksData.map(r => `- ${r.content}`).join('\n')}` : ''}
${recentQuotations.length > 0 ? `\n近期报价：\n${recentQuotations.map(q => `- ${q.quotation_number} (${q.document_kind || 'Q'}) | ${q.trade_term} | ${q.currency} ${q.total_amount_foreign?.toFixed(2)}`).join('\n')}` : ''}
`
    }

    // Build quotation context section
    let quotationSection = ''
    if (quotation) {
      const qProducts = (quotation.products || []) as any[]
      const productsText = qProducts
        .map((p: any) => `  · ${p.name}${p.model ? ` (${p.model})` : ''}: ${p.qty} ${p.unit || 'pc'} @ ${quotation.currency} ${p.unit_price_foreign}`)
        .join('\n')
      quotationSection = `
=== 当前绑定报价单 ===
单号：${quotation.quotation_number} (${quotation.document_kind || 'Q'})
日期：${new Date(quotation.created_at).toLocaleDateString('zh-CN')}
贸易术语：${quotation.trade_term}
币种：${quotation.currency}（汇率 ${quotation.exchange_rate || '—'}）
产品：
${productsText}
总金额：${quotation.currency} ${quotation.total_amount_foreign?.toFixed(2)}
付款条件：${quotation.payment_terms || '—'}
交货期：${quotation.delivery_time || '—'}
有效期：${quotation.validity_days || 30} 天
包装：${quotation.packing || '—'}
${quotation.remarks ? `备注：${quotation.remarks}` : ''}
`
    }

    const systemPrompt = `You are an expert foreign trade sales assistant for ${companyName}${profile?.company_name_cn ? ` (${profile.company_name_cn})` : ''}.

=== 公司信息 ===
名称：${companyName}
${profile?.address ? `地址：${profile.address}` : ''}
${profile?.phone ? `电话：${profile.phone}` : ''}
${profile?.email ? `邮箱：${profile.email}` : ''}
${profile?.website ? `网站：${profile.website}` : ''}
${profile?.default_payment_terms ? `默认付款条件：${profile.default_payment_terms}` : ''}

=== 产品目录（${products.length} 个产品）===
${productList || '暂无产品数据。'}
${customerSection}${quotationSection}
=== 你的能力 ===
1. 解析客户询盘邮件，提取关键信息
2. 起草专业英文报价回复邮件
3. 帮助进行价格谈判，维护利润空间
4. 解答贸易术语（Incoterms）、付款方式、出口物流等问题
5. 根据成本估算报价

重要规则：
- 默认用中文回复，除非用户要求英文或需要起草英文邮件
- 如果绑定了客户或报价单，请结合这些具体信息给出有针对性的建议
- 成本价是内部信息，不要在英文邮件草稿中透露给客户
- 简洁、实用，帮助促成成交`

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
