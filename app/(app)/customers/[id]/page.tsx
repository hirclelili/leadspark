'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Building, Mail, Phone, Globe, Calendar, FileText,
  MessageSquare, Loader2, Plus, Edit, Trash2, Sparkles, ClipboardCopy, Bell
} from 'lucide-react'
import { useUserProfile } from '@/contexts/UserProfileContext'
import { formatDate } from '@/lib/format'
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
import { toast } from 'sonner'
import { AiSidePanel } from '@/components/AiSidePanel'
import { AddTaskDialog } from '@/components/AddTaskDialog'

interface Customer {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  country: string | null
  address: string | null
  status: string
  notes: string | null
  created_at: string
}

interface Quotation {
  id: string
  quotation_number: string
  trade_term: string
  currency: string
  total_amount_foreign: number
  created_at: string
  products?: Array<{ name: string; qty: number; unit: string; unit_price_foreign?: number; cost_price?: number }>
}

interface Remark {
  id: string
  content: string
  created_at: string
}

const statusOptions = [
  { value: 'new', label: '新客户' },
  { value: 'quoted', label: '已报价' },
  { value: 'negotiating', label: '谈判中' },
  { value: 'won', label: '已成交' },
  { value: 'lost', label: '已流失' },
]

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { profile: userProfile } = useUserProfile()

  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [remarks, setRemarks] = useState<Remark[]>([])

  // Edit state
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    country: '',
    address: '',
    status: 'new',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // Remark input
  const [remarkInput, setRemarkInput] = useState('')
  const [addingRemark, setAddingRemark] = useState(false)

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  // AI side panel
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiMode, setAiMode] = useState<'reply' | 'negotiate'>('reply')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiReplyResult, setAiReplyResult] = useState<{ subject: string; body: string } | null>(null)
  const [aiNegotiateResult, setAiNegotiateResult] = useState('')
  const [negotiateMessage, setNegotiateMessage] = useState('')
  const [negotiateMinPrice, setNegotiateMinPrice] = useState('')
  const [negotiateMarginInfo, setNegotiateMarginInfo] = useState<{
    cost_price: number; quoted_price: number; margin_pct: number; margin_amt: number; suggested_floor: number
  } | null>(null)

  useEffect(() => {
    if (id) {
      fetchCustomer()
    }
  }, [id])

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${id}`)
      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
        router.push('/customers')
      } else {
        setCustomer(data.customer)
        setQuotations(data.quotations || [])
        setRemarks(data.remarks || [])
        setFormData({
          company_name: data.customer.company_name,
          contact_name: data.customer.contact_name || '',
          email: data.customer.email || '',
          phone: data.customer.phone || '',
          country: data.customer.country || '',
          address: data.customer.address || '',
          status: data.customer.status,
          notes: data.customer.notes || '',
        })
      }
    } catch (error) {
      console.error('Error:', error)
      router.push('/customers')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.company_name.trim()) { toast.error('公司名称不能为空'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || '保存失败')
      } else {
        toast.success('更新成功')
        setEditing(false)
        setCustomer(data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('保存失败，请检查网络连接')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRemark = async () => {
    if (!remarkInput.trim()) return

    setAddingRemark(true)
    try {
      const res = await fetch(`/api/customers/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: remarkInput }),
      })

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        setRemarkInput('')
        setRemarks([data, ...remarks])
        toast.success('添加成功')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败，请重试')
    } finally {
      setAddingRemark(false)
    }
  }

  const openAiPanel = async (mode: 'reply' | 'negotiate') => {
    setAiMode(mode)
    setAiReplyResult(null)
    setAiNegotiateResult('')
    setAiPanelOpen(true)
    if (mode === 'reply') {
      handleGenerateReply()
    }
  }

  const handleGenerateReply = async () => {
    setAiGenerating(true)
    setAiReplyResult(null)
    try {
      const companyName = userProfile?.company_name || ''

      const q = quotations[0]
      if (!q) { toast.error('该客户暂无报价记录'); setAiGenerating(false); return }

      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotation: {
            quotation_number: q.quotation_number,
            trade_term: q.trade_term,
            currency: q.currency,
            products: (q.products || []).map((p) => ({
              name: p.name,
              quantity: p.qty,
              unit: p.unit,
              unit_price: p.unit_price_foreign || 0,
            })),
            total_amount_foreign: q.total_amount_foreign,
          },
          customer: {
            company_name: customer?.company_name || '',
            contact_name: customer?.contact_name || undefined,
          },
          company_name: companyName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setAiReplyResult({ subject: data.email_subject || '', body: data.email_body || '' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleNegotiate = async () => {
    if (!negotiateMessage.trim()) { toast.error('请填写客户议价消息'); return }
    setAiGenerating(true)
    setAiNegotiateResult('')
    setNegotiateMarginInfo(null)
    try {
      const q = quotations[0]
      const p0 = q?.products?.[0]
      const productName = p0?.name || customer?.company_name || '产品'
      const quotedPrice = p0?.unit_price_foreign || 0
      const costPrice = p0?.cost_price || 0
      const currency = q?.currency || 'USD'

      const res = await fetch('/api/ai/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_message: negotiateMessage,
          product_name: productName,
          quoted_price: quotedPrice,
          currency,
          cost_price: costPrice > 0 ? costPrice : undefined,
          min_price: negotiateMinPrice ? parseFloat(negotiateMinPrice) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setAiNegotiateResult(data.reply || '')
      if (data.margin_info) setNegotiateMarginInfo(data.margin_info)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setAiGenerating(false)
    }
  }

  const formatPrice = (price: number, currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
    }
    return `${symbols[currency] || currency}${price.toFixed(2)}`
  }

  const getStatusLabel = (s: string) => {
    const opt = statusOptions.find((o) => o.value === s)
    return opt?.label || s
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>客户信息</CardTitle>
            {!editing ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Bell className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                  设置跟进提醒
                </Button>
                <Button variant="outline" size="sm" onClick={() => openAiPanel('reply')}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                  AI 报价邮件
                </Button>
                <Button variant="outline" size="sm" onClick={() => openAiPanel('negotiate')}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
                  AI 议价回复
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false)
                    setFormData({
                      company_name: customer?.company_name || '',
                      contact_name: customer?.contact_name || '',
                      email: customer?.email || '',
                      phone: customer?.phone || '',
                      country: customer?.country || '',
                      address: customer?.address || '',
                      status: customer?.status || 'new',
                      notes: customer?.notes || '',
                    })
                  }}
                >
                  取消
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">公司名称</label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">联系人</label>
                    <Input
                      value={formData.contact_name}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">国家</label>
                    <Input
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">邮箱</label>
                    <Input
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">电话</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">地址</label>
                  <Input
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="公司地址"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">状态</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as string })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">备注</label>
                  <Input
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{customer?.company_name}</span>
                </div>
                {customer?.contact_name && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <span>{customer.contact_name}</span>
                  </div>
                )}
                {customer?.country && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <span>{customer.country}</span>
                  </div>
                )}
                {customer?.email && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer?.phone && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer?.address && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Building className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{customer.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">状态：</span>
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {getStatusLabel(customer?.status || 'new')}
                  </span>
                </div>
                {customer?.notes && (
                  <div className="text-sm text-gray-600 mt-2">
                    {customer.notes}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotation Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              报价记录
              <span className="text-sm font-normal text-gray-400 ml-1">
                ({quotations.length})
              </span>
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                if (customer) {
                  localStorage.setItem('leadspark_quote_prefill_customer', JSON.stringify({
                    id: customer.id,
                    company_name: customer.company_name,
                    contact_name: customer.contact_name,
                    address: customer.address,
                    email: customer.email,
                    phone: customer.phone,
                    country: customer.country,
                    status: customer.status,
                    notes: customer.notes,
                    created_at: customer.created_at,
                  }))
                }
                router.push('/quote')
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              新建报价
            </Button>
          </CardHeader>
          <CardContent>
            {quotations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500 mb-3">暂无报价记录</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/quote')}
                >
                  去报价
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {quotations.map((q) => (
                  <div
                    key={q.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                    onClick={() => router.push(`/quote/history/${q.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-sm group-hover:text-blue-700">
                        {q.quotation_number}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(q.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 flex items-center justify-between">
                      <span>
                        {q.trade_term}
                        {q.products && q.products.length > 0 && (
                          <span className="text-gray-400 ml-2">
                            · {q.products[0].name}
                            {q.products[0].qty && ` ×${q.products[0].qty}`}
                            {q.products.length > 1 && ` 等${q.products.length}项`}
                          </span>
                        )}
                      </span>
                      <div className="text-right">
                        {q.products && q.products.length > 0 && q.products[0].unit_price_foreign != null && (
                          <div className="text-xs text-gray-400">
                            单价 {formatPrice(q.products[0].unit_price_foreign, q.currency)}
                          </div>
                        )}
                        <span className="font-medium text-blue-700">
                          {formatPrice(q.total_amount_foreign, q.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              备注
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                placeholder="添加备注..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddRemark()}
              />
              <Button
                onClick={handleAddRemark}
                disabled={addingRemark || !remarkInput.trim()}
              >
                {addingRemark ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
            {remarks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">暂无备注</p>
            ) : (
              <div className="space-y-3">
                {remarks.map((remark) => (
                  <div
                    key={remark.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="text-sm">{remark.content}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {formatDate(remark.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Dialog */}
      <AddTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        customerId={customer?.id}
        customerName={customer?.company_name}
      />

      {/* AI 侧边面板 */}
      <AiSidePanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        title={aiMode === 'reply' ? 'AI 生成报价邮件' : 'AI 议价回复'}
      >
        {aiMode === 'reply' ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-500">基于最近一条报价记录，自动生成专业英文报价回复邮件。</p>

            {aiGenerating && (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">AI 生成中...</span>
              </div>
            )}

            {!aiGenerating && !aiReplyResult && (
              <Button className="w-full" onClick={handleGenerateReply}>
                <Sparkles className="mr-2 h-4 w-4" />
                生成邮件
              </Button>
            )}

            {aiReplyResult && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">邮件主题</label>
                    <button className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                      onClick={() => { navigator.clipboard.writeText(aiReplyResult.subject); toast.success('已复制') }}>
                      <ClipboardCopy className="w-3 h-3" />复制
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3 text-sm font-medium border">{aiReplyResult.subject}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">邮件正文</label>
                    <button className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                      onClick={() => { navigator.clipboard.writeText(aiReplyResult.body); toast.success('已复制') }}>
                      <ClipboardCopy className="w-3 h-3" />复制
                    </button>
                  </div>
                  <Textarea value={aiReplyResult.body}
                    onChange={(e) => setAiReplyResult((prev) => prev ? { ...prev, body: e.target.value } : prev)}
                    rows={16} className="text-sm font-mono resize-none" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1"
                    onClick={() => { navigator.clipboard.writeText(`Subject: ${aiReplyResult.subject}\n\n${aiReplyResult.body}`); toast.success('已复制全部') }}>
                    <ClipboardCopy className="mr-2 h-4 w-4" />复制全部
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleGenerateReply} disabled={aiGenerating}>
                    重新生成
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-500">粘贴客户的还价消息，AI 自动生成专业的议价回复邮件。</p>

            {quotations[0] && (() => {
              const q = quotations[0]
              const p0 = q.products?.[0]
              const costPrice = p0?.cost_price
              const quotedPrice = p0?.unit_price_foreign
              const marginPct = costPrice && quotedPrice && quotedPrice > 0
                ? (((quotedPrice - costPrice) / quotedPrice) * 100).toFixed(1)
                : null
              return (
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1.5">
                  <div className="flex justify-between"><span className="text-blue-500">报价单</span><span>{q.quotation_number}</span></div>
                  <div className="flex justify-between"><span className="text-blue-500">产品</span><span>{p0?.name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-blue-500">报价单价</span><span>{q.currency} {quotedPrice?.toFixed(4) || '—'}/{p0?.unit || 'pc'}</span></div>
                  {costPrice && costPrice > 0 && (
                    <div className="flex justify-between"><span className="text-blue-500">成本价</span><span>¥{costPrice}</span></div>
                  )}
                  {marginPct && (
                    <div className="flex justify-between font-medium border-t border-blue-200 pt-1 mt-1">
                      <span className="text-blue-500">当前利润率</span>
                      <span className={parseFloat(marginPct) < 15 ? 'text-orange-600' : 'text-green-600'}>{marginPct}%</span>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="space-y-2">
              <label className="text-sm font-medium">客户议价消息</label>
              <Textarea placeholder="粘贴客户的还价邮件内容..." rows={6} value={negotiateMessage}
                onChange={(e) => setNegotiateMessage(e.target.value)} className="resize-none text-sm" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">最低可接受单价（可选）</label>
              <Input type="number" placeholder={`如 ${quotations[0]?.currency || 'USD'} 10.00`}
                value={negotiateMinPrice} onChange={(e) => setNegotiateMinPrice(e.target.value)} />
            </div>

            <Button className="w-full" onClick={handleNegotiate} disabled={aiGenerating}>
              {aiGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              生成议价回复
            </Button>

            {negotiateMarginInfo && (
              <div className="bg-gray-50 border rounded-lg p-3 text-xs space-y-1.5">
                <div className="font-medium text-gray-600 mb-1">利润空间分析</div>
                <div className="flex justify-between text-gray-500">
                  <span>报价</span>
                  <span>{quotations[0]?.currency} {negotiateMarginInfo.quoted_price}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>成本</span>
                  <span>¥{negotiateMarginInfo.cost_price}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>当前利润率</span>
                  <span className={negotiateMarginInfo.margin_pct < 15 ? 'text-orange-600' : 'text-green-600'}>
                    {negotiateMarginInfo.margin_pct}%
                  </span>
                </div>
                <div className="flex justify-between text-gray-500 border-t pt-1">
                  <span>建议底价（保留15%）</span>
                  <span>{quotations[0]?.currency} {negotiateMarginInfo.suggested_floor.toFixed(4)}</span>
                </div>
              </div>
            )}

            {aiNegotiateResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">回复草稿</label>
                  <button className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                    onClick={() => { navigator.clipboard.writeText(aiNegotiateResult); toast.success('已复制') }}>
                    <ClipboardCopy className="w-3 h-3" />复制
                  </button>
                </div>
                <Textarea value={aiNegotiateResult}
                  onChange={(e) => setAiNegotiateResult(e.target.value)}
                  rows={14} className="text-sm font-mono resize-none" />
              </div>
            )}
          </div>
        )}
      </AiSidePanel>
    </div>
  )
}