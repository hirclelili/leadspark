'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Download, Building, Loader2, FileText, Calendar,
  CreditCard, Package, Truck, Hash
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

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
  products: Array<{
    name: string
    model?: string
    specs?: string
    qty: number
    unit: string
    cost_price: number
    unit_price_foreign: number
    amount_foreign: number
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

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export default function QuotationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

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

      const element = React.createElement(QuotationPDF, {
        companyName: profile?.company_name || 'Your Company',
        companyNameCn: profile?.company_name_cn,
        address: profile?.address,
        phone: profile?.phone,
        email: profile?.email,
        website: profile?.website,
        logoUrl: profile?.logo_url,
        clientName: quotation.customers?.company_name || '—',
        clientContact: quotation.customers?.contact_name || undefined,
        quotationNumber: quotation.quotation_number,
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
        })),
        totalAmount: quotation.total_amount_foreign,
        paymentTerms: quotation.payment_terms,
        deliveryTime: quotation.delivery_time,
        packing: quotation.packing || undefined,
        remarks: quotation.remarks || undefined,
        type: 'QUOTATION',
      })

      const blob = await pdf(element).toBlob()
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
            报价历史
          </Button>
        </div>
        <Button onClick={handleRedownload} disabled={downloading}>
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          重新下载 PDF
        </Button>
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
        <Badge variant="outline" className="text-sm px-3 py-1">
          {quotation.trade_term}
        </Badge>
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
    </div>
  )
}
