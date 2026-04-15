'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Download, Building, Loader2, FileText,
  CreditCard, Package, Truck, Hash, Copy, ChevronDown, Send, Sparkles, ClipboardCopy, Ship, FileSpreadsheet
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { DocumentKind, QuoteLayoutMode } from '@/components/pdf/QuotationPDF'
import { AiSidePanel } from '@/components/AiSidePanel'
import { exportQuoteExcel } from '@/lib/exportQuoteExcel'

const STATUS_CONFIG = {
  draft:       { label: '草稿',   color: 'bg-gray-100 text-gray-600' },
  sent:        { label: '已发送', color: 'bg-blue-100 text-blue-700' },
  negotiating: { label: '议价中', color: 'bg-yellow-100 text-yellow-700' },
  won:         { label: '已成交', color: 'bg-green-100 text-green-700' },
  lost:        { label: '已流失', color: 'bg-red-100 text-red-600' },
} as const
type QuoteStatus = keyof typeof STATUS_CONFIG

interface QuotationDetail {
  id: string
  quotation_number: string
  trade_term: string
  currency: string
  exchange_rate: number
  total_amount_foreign: number
  total_amount_cny: number
  payment_terms: string
  delivery_time: string
  validity_days: number
  packing: string | null
  remarks: string | null
  created_at: string
  status?: QuoteStatus
  document_kind?: string | null
  reference_number?: string | null
  seller_visible_pl?: boolean | null
  seller_visible_pi?: boolean | null
  seller_visible_ci?: boolean | null
  po_number?: string | null
  deposit_percent?: number | null
  quote_mode?: string | null
  products: Array<{
    name: string
    model?: string
    specs?: string
    qty: number
    unit: string
    cost_price: number
    unit_price_foreign: number
    amount_foreign: number
    is_container_header?: boolean
  }>
  costs: {
    domestic_cost: number
    freight: number
    destination_cost: number
    insurance_rate: number
    profit_rate: number
  }
  customers: {
    company_name: string
    contact_name: string | null
    email: string | null
    country: string | null
  } | null
  customer_id: string | null
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  AED: 'AED ',
  SGD: 'S$',
  CNY: '¥',
  HKD: 'HK$',
}

export default function QuotationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  // AI side panel
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiEmailResult, setAiEmailResult] = useState<{ subject: string; body: string } | null>(null)

  const handleGenerateReply = async (q: QuotationDetail) => {
    setAiGenerating(true)
    setAiEmailResult(null)
    try {
      // Fetch company name from profile
      let companyName = ''
      try {
        const pr = await fetch('/api/user-profile')
        const p = await pr.json()
        companyName = p?.company_name || ''
      } catch { /* ignore */ }

      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotation: {
            quotation_number: q.quotation_number,
            trade_term: q.trade_term,
            currency: q.currency,
            products: q.products
              .filter((p) => !p.is_container_header)
              .map((p) => ({
                name: p.name,
                quantity: p.qty,
                unit: p.unit,
                unit_price: p.unit_price_foreign,
              })),
            total_amount_foreign: q.total_amount_foreign,
            payment_terms: q.payment_terms,
            delivery_time: q.delivery_time,
            validity_days: q.validity_days,
          },
          customer: {
            company_name: q.customers?.company_name || '',
            contact_name: q.customers?.contact_name || undefined,
          },
          company_name: companyName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setAiEmailResult({ subject: data.email_subject || '', body: data.email_body || '' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSendEmail = async () => {
    if (!quotation) return
    setSendingEmail(true)
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/send-email`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || '发送失败')
        return
      }
      toast.success(`邮件已发送至 ${data.to}`)
      setQuotation((prev) => prev ? { ...prev, status: 'sent' } : prev)
    } catch {
      toast.error('发送失败，请检查网络')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleStatusChange = async (status: QuoteStatus) => {
    if (!quotation) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setQuotation((prev) => prev ? { ...prev, status } : prev)
      toast.success(`状态已更新为「${STATUS_CONFIG[status].label}」`)
    } catch {
      toast.error('更新失败')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleGenerateCiPl = () => {
    if (!quotation) return
    const prefill = {
      customerName: quotation.customers?.company_name || '',
      customerContact: quotation.customers?.contact_name || '',
      currency: quotation.currency,
      tradeTerm: quotation.trade_term,
      paymentTerms: quotation.payment_terms || '',
      piNumber: quotation.quotation_number,
      products: quotation.products
        .filter((p) => !p.is_container_header)
        .map((p) => ({
          name: p.name,
          model: p.model || '',
          qty: p.qty,
          unit: p.unit,
          unit_price_foreign: p.unit_price_foreign,
          amount_foreign: p.amount_foreign,
        })),
    }
    localStorage.setItem('leadspark_cipl_prefill', JSON.stringify(prefill))
    router.push('/documents/ci-pl')
  }

  const handleDuplicate = () => {
    if (!quotation) return
    const dataRows = quotation.products.filter((p) => !p.is_container_header)
    const draft = {
      calcProducts: dataRows.map((p) => ({
        id: crypto.randomUUID(),
        name: p.name,
        model: p.model || '',
        unit: p.unit,
        costPrice: String(p.cost_price || ''),
        quantity: String(p.qty),
      })),
      formData: {
        domesticCost: String(quotation.costs.domestic_cost || 0),
        freight: String(quotation.costs.freight || 0),
        destinationCost: String(quotation.costs.destination_cost || 0),
        insuranceRate: String(quotation.costs.insurance_rate || 0.3),
        profitRate: String(quotation.costs.profit_rate || 10),
        currency: quotation.currency,
      },
      quoteDetails: {
        tradeTerm: quotation.trade_term,
        documentKind: (quotation.document_kind as 'QUOTATION' | 'PL' | 'PI' | 'CI') || 'QUOTATION',
        referenceNumber: quotation.reference_number || '',
        poNumber: quotation.po_number || '',
        depositPercent: String(quotation.deposit_percent ?? 30),
        sellerVisiblePl: quotation.seller_visible_pl !== false,
        sellerVisiblePi: quotation.seller_visible_pi !== false,
        sellerVisibleCi: quotation.seller_visible_ci !== false,
        paymentTerms: quotation.payment_terms,
        deliveryTime: quotation.delivery_time,
        packing: quotation.packing || '',
        remarks: quotation.remarks || '',
        validityDays: quotation.validity_days,
      },
      quoteLayoutMode: quotation.quote_mode === 'container_group' ? 'container_group' : 'product_list',
      pdfProducts: quotation.products.map((p) =>
        p.is_container_header
          ? {
              isContainerHeader: true as const,
              name: p.name,
              model: p.model || '',
              specs: p.specs || '',
              qty: 0,
              unit: '',
              unit_price_foreign: 0,
              amount_foreign: 0,
            }
          : {
              isContainerHeader: false as const,
              name: p.name,
              model: p.model || '',
              specs: p.specs || '',
              qty: p.qty,
              unit: p.unit,
              unit_price_foreign: p.unit_price_foreign,
              amount_foreign: p.amount_foreign,
            }
      ),
    }
    localStorage.setItem('leadspark_quote_draft', JSON.stringify(draft))
    router.push('/quote')
  }

  useEffect(() => {
    if (id) fetchQuotation()
  }, [id])

  const fetchQuotation = async () => {
    try {
      const res = await fetch(`/api/quotations/${id}`)
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        router.push('/quote/history')
      } else {
        setQuotation(data)
      }
    } catch {
      router.push('/quote/history')
    } finally {
      setLoading(false)
    }
  }

  const handleRedownloadExcel = async () => {
    if (!quotation) return
    setDownloadingExcel(true)
    try {
      const profileRes = await fetch('/api/user-profile')
      const profile = profileRes.ok ? await profileRes.json() : null
      const docKind = (quotation.document_kind === 'PI' ? 'PI' : 'QUOTATION') as 'PI' | 'QUOTATION'
      const displayNo = (quotation.reference_number?.trim()) || quotation.quotation_number
      await exportQuoteExcel({
        documentKind: docKind,
        companyName: profile?.company_name || 'Your Company',
        companyNameCn: profile?.company_name_cn,
        address: profile?.address,
        phone: profile?.phone,
        email: profile?.email,
        website: profile?.website,
        bankName: profile?.bank_name,
        bankAccount: profile?.bank_account,
        bankSwift: profile?.bank_swift,
        bankBeneficiary: profile?.bank_beneficiary,
        clientName: quotation.customers?.company_name || '—',
        clientContact: quotation.customers?.contact_name || undefined,
        documentNumber: displayNo,
        date: new Date(quotation.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        validityDays: quotation.validity_days,
        tradeTerm: quotation.trade_term,
        currency: quotation.currency,
        paymentTerms: quotation.payment_terms,
        deliveryTime: quotation.delivery_time,
        packing: quotation.packing || undefined,
        remarks: quotation.remarks || undefined,
        poNumber: quotation.po_number?.trim() || undefined,
        depositPercent: docKind === 'PI' ? Number(quotation.deposit_percent) || 0 : 0,
        products: quotation.products.map(p => ({
          name: p.name,
          model: p.model || undefined,
          specs: p.specs || undefined,
          qty: p.qty,
          unit: p.unit,
          unit_price_foreign: p.unit_price_foreign,
          amount_foreign: p.amount_foreign,
          is_container_header: p.is_container_header === true,
        })),
        totalAmount: quotation.total_amount_foreign,
      })
      toast.success('Excel 下载成功')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '下载失败')
    } finally {
      setDownloadingExcel(false)
    }
  }

  const handleRedownload = async () => {
    if (!quotation) return
    setDownloading(true)
    try {
      // Fetch user profile for company info
      const profileRes = await fetch('/api/user-profile')
      const profile = profileRes.ok ? await profileRes.json() : null

      const { pdf } = await import('@react-pdf/renderer')
      const { QuotationPDF } = await import('@/components/pdf/QuotationPDF')

      const today = new Date(quotation.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })

      const docKind = (quotation.document_kind as DocumentKind) || 'PI'
      const showSellerHeader =
        docKind === 'PL'
          ? quotation.seller_visible_pl !== false
          : docKind === 'PI' || docKind === 'QUOTATION'
            ? quotation.seller_visible_pi !== false
            : quotation.seller_visible_ci !== false

      // react-pdf can only load absolute http/https URLs for images
      const safeLogoUrl = profile?.logo_url && /^https?:\/\//i.test(profile.logo_url)
        ? profile.logo_url : undefined

      const element = React.createElement(QuotationPDF, {
        companyName: profile?.company_name || 'Your Company',
        companyNameCn: profile?.company_name_cn,
        address: profile?.address,
        phone: profile?.phone,
        email: profile?.email,
        website: profile?.website,
        logoUrl: safeLogoUrl,
        bankName: profile?.bank_name,
        bankAccount: profile?.bank_account,
        bankSwift: profile?.bank_swift,
        bankBeneficiary: profile?.bank_beneficiary,
        clientName: quotation.customers?.company_name || '—',
        clientContact: quotation.customers?.contact_name || undefined,
        quotationNumber: quotation.quotation_number,
        documentNumberDisplay: (quotation.reference_number && quotation.reference_number.trim()) || quotation.quotation_number,
        date: today,
        validityDays: quotation.validity_days,
        tradeTerm: quotation.trade_term,
        currency: quotation.currency,
        products: quotation.products.map((p) => ({
          name: p.name,
          model: p.model,
          specs: p.specs,
          qty: p.qty,
          unit: p.unit,
          unit_price_foreign: p.unit_price_foreign,
          amount_foreign: p.amount_foreign,
          is_container_header: p.is_container_header === true,
        })),
        quoteMode: (quotation.quote_mode === 'container_group' ? 'container_group' : 'product_list') as QuoteLayoutMode,
        totalAmount: quotation.total_amount_foreign,
        paymentTerms: quotation.payment_terms,
        deliveryTime: quotation.delivery_time,
        packing: quotation.packing || undefined,
        remarks: quotation.remarks || undefined,
        documentKind: docKind,
        showSellerHeader,
        poNumber: quotation.po_number?.trim() || undefined,
        depositPercent:
          docKind === 'PI' ? Number(quotation.deposit_percent) || 0 : 0,
      })

      const blob = await pdf(element as Parameters<typeof pdf>[0]).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quotation.quotation_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDF 下载成功')
    } catch (err: any) {
      toast.error(err.message || '下载失败')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!quotation) return null

  const sym = CURRENCY_SYMBOL[quotation.currency] || ''

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/quote/history')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            订单跟进
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setAiEmailResult(null); setAiPanelOpen(true); handleGenerateReply(quotation) }}>
            <Sparkles className="mr-1.5 h-4 w-4 text-blue-500" />
            AI 生成回复邮件
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateCiPl}>
            <Ship className="mr-1.5 h-4 w-4" />
            生成 CI/PL
          </Button>
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            复用此报价
          </Button>
          {quotation.customers?.email && (
            <Button variant="outline" onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              发送给客户
            </Button>
          )}
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleRedownloadExcel} disabled={downloadingExcel}>
            {downloadingExcel ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            下载 Excel
          </Button>
          <Button variant="outline" onClick={handleRedownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            下载 PDF
          </Button>
        </div>
      </div>

      {/* Quote number + meta */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">{quotation.quotation_number}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date(quotation.created_at).toLocaleDateString('zh-CN', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {quotation.trade_term}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                `text-xs font-medium ${STATUS_CONFIG[quotation.status || 'draft'].color} border-0`
              )}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              {STATUS_CONFIG[quotation.status || 'draft'].label}
              <ChevronDown className="ml-1 h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.entries(STATUS_CONFIG) as [QuoteStatus, typeof STATUS_CONFIG[QuoteStatus]][]).map(([key, cfg]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  className={key === (quotation.status || 'draft') ? 'font-bold' : ''}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${cfg.color.split(' ')[0]}`} />
                  {cfg.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="w-4 h-4" />
              客户信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {quotation.customers ? (
              <>
                <div className="font-medium text-base">{quotation.customers.company_name}</div>
                {quotation.customers.contact_name && (
                  <div className="text-gray-600">{quotation.customers.contact_name}</div>
                )}
                {quotation.customers.email && (
                  <div className="text-gray-500">{quotation.customers.email}</div>
                )}
                {quotation.customers.country && (
                  <div className="text-gray-500">{quotation.customers.country}</div>
                )}
                {quotation.customer_id && (
                  <Link
                    href={`/customers/${quotation.customer_id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    查看客户详情 →
                  </Link>
                )}
              </>
            ) : (
              <span className="text-gray-400">未关联客户</span>
            )}
          </CardContent>
        </Card>

        {/* Quote meta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="w-4 h-4" />
              报价信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">贸易术语</span>
              <span className="font-medium">{quotation.trade_term}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">货币</span>
              <span className="font-medium">{quotation.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">汇率 (CNY/外币)</span>
              <span className="font-medium">{quotation.exchange_rate.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">报价有效期</span>
              <span className="font-medium">{quotation.validity_days} 天</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            产品明细
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 pr-4">产品</th>
                  <th className="text-right py-2 px-4">数量</th>
                  <th className="text-right py-2 px-4">单价</th>
                  <th className="text-right py-2 pl-4">小计</th>
                </tr>
              </thead>
              <tbody>
                {quotation.products.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{p.name}</div>
                      {p.model && <div className="text-gray-500 text-xs">{p.model}</div>}
                      {p.specs && <div className="text-gray-400 text-xs">{p.specs}</div>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.qty} {p.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {sym}{p.unit_price_foreign.toFixed(4)}
                    </td>
                    <td className="py-3 pl-4 text-right font-mono font-medium">
                      {sym}{p.amount_foreign.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="py-3 px-4 text-right font-bold">合计</td>
                  <td className="py-3 pl-4 text-right font-mono font-bold text-blue-700">
                    {sym}{quotation.total_amount_foreign.toFixed(2)}
                  </td>
                </tr>
                <tr className="text-gray-400 text-xs">
                  <td colSpan={3} className="py-1 px-4 text-right">人民币约</td>
                  <td className="py-1 pl-4 text-right font-mono">
                    ¥{quotation.total_amount_cny.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              付款 & 交货
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">付款条件</div>
              <div className="font-medium">{quotation.payment_terms || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">交货期</div>
              <div className="font-medium">{quotation.delivery_time || '—'}</div>
            </div>
            {quotation.packing && (
              <div>
                <div className="text-gray-500 text-xs mb-1">包装方式</div>
                <div className="font-medium">{quotation.packing}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" />
              成本参数
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">国内费用</span>
              <span>¥{quotation.costs.domestic_cost || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">海运费</span>
              <span>¥{quotation.costs.freight || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">目的港费用</span>
              <span>¥{quotation.costs.destination_cost || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">保险费率</span>
              <span>{quotation.costs.insurance_rate || 0.3}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">利润率</span>
              <span className="font-medium text-green-600">{quotation.costs.profit_rate || 10}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remarks */}
      {quotation.remarks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              备注
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* AI 生成回复邮件侧边面板 */}
      <AiSidePanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        title="AI 生成回复邮件"
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">基于当前报价单自动生成专业的英文报价回复邮件。</p>

          {aiGenerating && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">AI 生成中...</span>
            </div>
          )}

          {!aiGenerating && !aiEmailResult && (
            <Button className="w-full" onClick={() => handleGenerateReply(quotation)}>
              <Sparkles className="mr-2 h-4 w-4" />
              生成邮件
            </Button>
          )}

          {aiEmailResult && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">邮件主题</label>
                  <button
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                    onClick={() => { navigator.clipboard.writeText(aiEmailResult.subject); toast.success('已复制主题') }}
                  >
                    <ClipboardCopy className="w-3 h-3" />复制
                  </button>
                </div>
                <div className="bg-gray-50 rounded-md p-3 text-sm font-medium border">{aiEmailResult.subject}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">邮件正文</label>
                  <button
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                    onClick={() => { navigator.clipboard.writeText(aiEmailResult.body); toast.success('已复制正文') }}
                  >
                    <ClipboardCopy className="w-3 h-3" />复制
                  </button>
                </div>
                <Textarea
                  value={aiEmailResult.body}
                  onChange={(e) => setAiEmailResult((prev) => prev ? { ...prev, body: e.target.value } : prev)}
                  rows={16}
                  className="text-sm font-mono resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { navigator.clipboard.writeText(`Subject: ${aiEmailResult.subject}\n\n${aiEmailResult.body}`); toast.success('已复制全部') }}
                >
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  复制全部
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setAiEmailResult(null); handleGenerateReply(quotation) }}
                  disabled={aiGenerating}
                >
                  重新生成
                </Button>
              </div>
            </div>
          )}
        </div>
      </AiSidePanel>
    </div>
  )
}
