'use client'

import { useState } from 'react'
import { Bot, Loader2, Clipboard, Check, FileSearch, Mail, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'

const TRADE_TERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CPT', 'CIF', 'CIP', 'DAP', 'DPU', 'DDP']
const CURRENCIES = ['USD', 'EUR', 'GBP']

// ─── Tab 1: 询盘解析 ────────────────────────────────────────────────────────

interface ParsedInquiry {
  product_name: string | null
  quantity: number | null
  unit: string | null
  specs: string | null
  trade_term: string | null
  destination: string | null
  payment_terms: string | null
  delivery_deadline: string | null
  notes: string | null
  raw_summary: string | null
}

function ParseInquiryTab() {
  const [emailText, setEmailText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParsedInquiry | null>(null)

  const handleParse = async () => {
    if (!emailText.trim()) {
      toast.error('请粘贴询盘邮件内容')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/parse-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || '解析失败，请重试')
        return
      }
      setResult(data)
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const fields: { key: keyof ParsedInquiry; label: string }[] = [
    { key: 'product_name', label: '产品名称' },
    { key: 'quantity', label: '数量' },
    { key: 'unit', label: '单位' },
    { key: 'specs', label: '规格/要求' },
    { key: 'trade_term', label: '贸易术语' },
    { key: 'destination', label: '目的地' },
    { key: 'payment_terms', label: '付款方式' },
    { key: 'delivery_deadline', label: '交货期要求' },
    { key: 'notes', label: '其他备注' },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">粘贴询盘邮件</label>
        <Textarea
          placeholder="请将客户发来的询盘邮件内容粘贴至此处..."
          className="min-h-[200px] resize-y font-mono text-sm"
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
        />
        <Button onClick={handleParse} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI 解析中...
            </>
          ) : (
            <>
              <FileSearch className="mr-2 h-4 w-4" />
              AI 解析
            </>
          )}
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-blue-600" />
              解析结果
            </CardTitle>
            {result.raw_summary && (
              <p className="text-sm text-gray-500 mt-1">{result.raw_summary}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {result[key] !== null && result[key] !== undefined
                      ? String(result[key])
                      : '—'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Tab 2: 邮件回复生成 ──────────────────────────────────────────────────────

interface ReplyResult {
  email_subject: string
  email_body: string
}

function GenerateReplyTab() {
  const [form, setForm] = useState({
    product_name: '',
    quantity: '',
    unit: '',
    trade_term: 'FOB',
    currency: 'USD',
    unit_price: '',
    payment_terms: 'T/T 30% deposit, 70% before shipment',
    delivery_time: '30 days after receipt of deposit',
    validity_days: '30',
    customer_company: '',
    customer_contact: '',
    my_company: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReplyResult | null>(null)
  const [copied, setCopied] = useState(false)

  const totalAmount =
    parseFloat(form.unit_price) && parseFloat(form.quantity)
      ? (parseFloat(form.unit_price) * parseFloat(form.quantity)).toFixed(2)
      : ''

  const handleGenerate = async () => {
    if (!form.product_name || !form.customer_company || !form.my_company) {
      toast.error('请填写产品名称、客户公司和我方公司名称')
      return
    }
    if (!form.unit_price || !form.quantity) {
      toast.error('请填写数量和单价')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotation: {
            trade_term: form.trade_term,
            currency: form.currency,
            products: [
              {
                name: form.product_name,
                quantity: parseFloat(form.quantity),
                unit: form.unit || 'pcs',
                unit_price: parseFloat(form.unit_price),
              },
            ],
            total_amount_foreign: parseFloat(totalAmount || '0'),
            payment_terms: form.payment_terms,
            delivery_time: form.delivery_time,
            validity_days: parseInt(form.validity_days) || 30,
          },
          customer: {
            company_name: form.customer_company,
            contact_name: form.customer_contact,
          },
          company_name: form.my_company,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || '生成失败，请重试')
        return
      }
      setResult(data)
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    const text = `Subject: ${result.email_subject}\n\n${result.email_body}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">产品名称 *</label>
          <Input
            placeholder="如：LED Flood Light 100W"
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">数量 *</label>
            <Input
              type="number"
              placeholder="1000"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">单位</label>
            <Input
              placeholder="pcs"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">贸易术语</label>
          <Select
            value={form.trade_term}
            onValueChange={(v) => setForm({ ...form, trade_term: v || form.trade_term })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRADE_TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">币种</label>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm({ ...form, currency: v || form.currency })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">单价 *</label>
            <Input
              type="number"
              placeholder="12.50"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            />
          </div>
        </div>

        {totalAmount && (
          <div className="sm:col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm">
            <span className="text-gray-500">总金额：</span>
            <span className="font-semibold text-blue-700">
              {form.currency} {totalAmount}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">付款方式</label>
          <Input
            placeholder="T/T 30% deposit, 70% before shipment"
            value={form.payment_terms}
            onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">交货期</label>
          <Input
            placeholder="30 days after receipt of deposit"
            value={form.delivery_time}
            onChange={(e) => setForm({ ...form, delivery_time: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">报价有效期（天）</label>
          <Input
            type="number"
            placeholder="30"
            value={form.validity_days}
            onChange={(e) => setForm({ ...form, validity_days: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">客户公司名称 *</label>
          <Input
            placeholder="ABC Trading Co., Ltd."
            value={form.customer_company}
            onChange={(e) => setForm({ ...form, customer_company: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">客户联系人</label>
          <Input
            placeholder="John Smith（可选）"
            value={form.customer_contact}
            onChange={(e) => setForm({ ...form, customer_contact: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">我方公司名称 *</label>
          <Input
            placeholder="Your Company Name"
            value={form.my_company}
            onChange={(e) => setForm({ ...form, my_company: e.target.value })}
          />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            生成邮件
          </>
        )}
      </Button>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                生成的报价邮件
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                    已复制
                  </>
                ) : (
                  <>
                    <Clipboard className="mr-1.5 h-3.5 w-3.5" />
                    复制
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">主题</p>
              <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded px-3 py-2">
                {result.email_subject}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">正文</p>
              <pre className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-3 whitespace-pre-wrap font-sans leading-relaxed">
                {result.email_body}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Tab 3: 议价助手 ──────────────────────────────────────────────────────────

function NegotiateTab() {
  const [form, setForm] = useState({
    customer_message: '',
    product_name: '',
    quoted_price: '',
    currency: 'USD',
    min_price: '',
    context: '',
  })
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!form.customer_message.trim() || !form.product_name || !form.quoted_price) {
      toast.error('请填写客户消息、产品名称和报价')
      return
    }

    setLoading(true)
    setReply('')
    try {
      const res = await fetch('/api/ai/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_message: form.customer_message,
          product_name: form.product_name,
          quoted_price: parseFloat(form.quoted_price),
          currency: form.currency,
          min_price: form.min_price ? parseFloat(form.min_price) : undefined,
          context: form.context || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || '生成失败，请重试')
        return
      }
      setReply(data.reply)
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-2">
          <label className="text-sm font-medium text-gray-700">客户还价消息 *</label>
          <Textarea
            placeholder="粘贴客户发来的还价或压价邮件内容..."
            className="min-h-[120px] resize-y"
            value={form.customer_message}
            onChange={(e) => setForm({ ...form, customer_message: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">产品名称 *</label>
          <Input
            placeholder="如：LED Flood Light 100W"
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2 col-span-2">
            <label className="text-sm font-medium text-gray-700">我方报价单价 *</label>
            <Input
              type="number"
              placeholder="12.50"
              value={form.quoted_price}
              onChange={(e) => setForm({ ...form, quoted_price: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">币种</label>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm({ ...form, currency: v || form.currency })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            最低可接受单价（可选）
          </label>
          <Input
            type="number"
            placeholder="10.00"
            value={form.min_price}
            onChange={(e) => setForm({ ...form, min_price: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <label className="text-sm font-medium text-gray-700">
            补充背景（可选）
          </label>
          <Textarea
            placeholder="如：该客户是重要客户、上次成交价为X等"
            className="min-h-[80px] resize-y"
            value={form.context}
            onChange={(e) => setForm({ ...form, context: e.target.value })}
          />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <MessageSquare className="mr-2 h-4 w-4" />
            生成回复
          </>
        )}
      </Button>

      {reply && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                议价回复草稿
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                    已复制
                  </>
                ) : (
                  <>
                    <Clipboard className="mr-1.5 h-3.5 w-3.5" />
                    复制
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[280px] font-sans text-sm leading-relaxed resize-y"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-2">可在上方直接编辑后再复制发送</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIPage() {
  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bot className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">AI 助手</h1>
          <p className="text-sm text-gray-500">智能解析询盘、生成报价邮件、辅助价格谈判</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="parse">
        <TabsList className="mb-2">
          <TabsTrigger value="parse">
            <FileSearch className="w-4 h-4 mr-1.5" />
            询盘解析
          </TabsTrigger>
          <TabsTrigger value="reply">
            <Mail className="w-4 h-4 mr-1.5" />
            邮件回复
          </TabsTrigger>
          <TabsTrigger value="negotiate">
            <MessageSquare className="w-4 h-4 mr-1.5" />
            议价助手
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parse">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI 询盘解析</CardTitle>
              <p className="text-sm text-gray-500">
                将客户发来的询盘邮件粘贴到下方，AI 将自动提取关键信息
              </p>
            </CardHeader>
            <CardContent>
              <ParseInquiryTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reply">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI 邮件回复生成</CardTitle>
              <p className="text-sm text-gray-500">
                填写报价信息，AI 自动生成专业英文报价回复邮件
              </p>
            </CardHeader>
            <CardContent>
              <GenerateReplyTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="negotiate">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI 议价助手</CardTitle>
              <p className="text-sm text-gray-500">
                粘贴客户的还价消息，AI 帮您生成得体的英文议价回复
              </p>
            </CardHeader>
            <CardContent>
              <NegotiateTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
