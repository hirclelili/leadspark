'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Quotation {
  id: string
  quotation_number: string
  trade_term: string
  currency: string
  total_amount_foreign: number
  created_at: string
  customer_id: string | null
  customers: { company_name: string } | null
  products: Array<{ name: string; qty: number }>
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
}

export default function QuoteHistoryPage() {
  const router = useRouter()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  useEffect(() => {
    fetchQuotations()
  }, [page])

  const fetchQuotations = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotations?page=${page}&limit=${limit}`)
      const data = await res.json()
      setQuotations(data.quotations || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6" />
        <h1 className="text-2xl font-bold">报价历史</h1>
        <span className="text-gray-400 text-sm">共 {total} 条</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : quotations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>暂无报价记录</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/quote')}
            >
              去生成报价单
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {quotations.map((q) => (
              <Card
                key={q.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() =>
                  q.customer_id && router.push(`/customers/${q.customer_id}`)
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">
                          {q.quotation_number}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {q.trade_term}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {q.customers?.company_name || '未关联客户'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {q.products?.length > 0 && (
                          <span>
                            {q.products[0].name}
                            {q.products.length > 1 && ` 等 ${q.products.length} 项`}
                            {' · '}
                            数量 {q.products[0].qty}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {CURRENCY_SYMBOL[q.currency] || ''}
                        {q.total_amount_foreign.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(q.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
