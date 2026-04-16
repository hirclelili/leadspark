'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, ChevronLeft, ChevronRight, Search, X, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STATUS_CONFIG = {
  draft:       { label: '草稿',   color: 'bg-gray-100 text-gray-500' },
  sent:        { label: '已发送', color: 'bg-blue-100 text-blue-600' },
  negotiating: { label: '议价中', color: 'bg-yellow-100 text-yellow-600' },
  won:         { label: '已成交', color: 'bg-green-100 text-green-700' },
  lost:        { label: '已流失', color: 'bg-red-100 text-red-500' },
} as const
type QuoteStatus = keyof typeof STATUS_CONFIG

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
  status?: QuoteStatus
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

function getDateRange(range: string): { date_from: string; date_to: string } {
  const now = new Date()
  if (range === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { date_from: from.toISOString().split('T')[0], date_to: '' }
  }
  if (range === '3months') {
    const from = new Date(now)
    from.setMonth(from.getMonth() - 3)
    return { date_from: from.toISOString().split('T')[0], date_to: '' }
  }
  return { date_from: '', date_to: '' }
}

export default function QuoteHistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  // Filter state (synced from URL)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [dateRange, setDateRange] = useState(searchParams.get('range') || '')

  // Debounce search input
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuotations = useCallback(async (
    pg: number,
    q: string,
    status: string,
    range: string
  ) => {
    setLoading(true)
    try {
      const { date_from, date_to } = getDateRange(range)
      const params = new URLSearchParams({ page: String(pg), limit: String(limit) })
      if (q) params.set('search', q)
      if (status) params.set('status', status)
      if (date_from) params.set('date_from', date_from)
      if (date_to) params.set('date_to', date_to)

      const res = await fetch(`/api/quotations?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : '加载报价记录失败')
      } else {
        setQuotations(data.quotations || [])
        setTotal(data.total || 0)
      }
    } catch (error) {
      toast.error('加载报价记录失败，请重试')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Sync URL params → state on mount
  useEffect(() => {
    fetchQuotations(page, search, statusFilter, dateRange)
  }, [page, statusFilter, dateRange])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setPage(1)
      fetchQuotations(1, value, statusFilter, dateRange)
      updateURL(value, statusFilter, dateRange)
    }, 300)
  }

  const handleStatusChange = (value: string | null) => {
    const raw = value ?? 'all'
    const v = raw === 'all' ? '' : raw
    setStatusFilter(v)
    setPage(1)
    updateURL(search, v, dateRange)
  }

  const handleDateRangeChange = (value: string | null) => {
    const raw = value ?? 'all'
    const v = raw === 'all' ? '' : raw
    setDateRange(v)
    setPage(1)
    updateURL(search, statusFilter, v)
  }

  const updateURL = (q: string, status: string, range: string) => {
    const params = new URLSearchParams()
    if (q) params.set('search', q)
    if (status) params.set('status', status)
    if (range) params.set('range', range)
    router.replace(`/quote/history${params.toString() ? '?' + params.toString() : ''}`, { scroll: false })
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setDateRange('')
    setPage(1)
    router.replace('/quote/history', { scroll: false })
    fetchQuotations(1, '', '', '')
  }

  const hasFilters = search || statusFilter || dateRange
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">订单跟进</h1>
          <span className="text-gray-400 text-sm">共 {total} 条</span>
        </div>
        <Link
          href="/quote"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          + 新建报价
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 pr-4"
            placeholder="搜索报价单号或客户名..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {(Object.entries(STATUS_CONFIG) as [QuoteStatus, typeof STATUS_CONFIG[QuoteStatus]][]).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateRange || 'all'} onValueChange={handleDateRangeChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部时间" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部时间</SelectItem>
            <SelectItem value="month">本月</SelectItem>
            <SelectItem value="3months">近3个月</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
            <X className="w-4 h-4 mr-1" />
            清除筛选
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : quotations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{hasFilters ? '没有符合条件的报价记录' : '暂无报价记录'}</p>
            {hasFilters ? (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                清除筛选
              </Button>
            ) : (
              <Button variant="outline" className="mt-4" onClick={() => router.push('/quote')}>
                去生成报价单
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {quotations.map((q) => (
              <Card
                key={q.id}
                className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                onClick={() => router.push(`/quote/history/${q.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm group-hover:text-blue-700 transition-colors">
                          {q.quotation_number}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {q.trade_term}
                        </Badge>
                        {q.status && q.status !== 'draft' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CONFIG[q.status].color}`}>
                            {STATUS_CONFIG[q.status].label}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(q.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {/* Customer */}
                      <div className="text-sm text-gray-700 font-medium truncate">
                        {q.customers?.company_name || (
                          <span className="text-gray-400 font-normal">未关联客户</span>
                        )}
                      </div>
                      {/* Products summary */}
                      {q.products?.length > 0 && (
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
                          {q.products.slice(0, 2).map((p, i) => (
                            <span key={i}>
                              {p.name}
                              {p.qty && ` ×${p.qty}`}
                              {q.products.length > 1 && i === 0 && q.products.length > 2 && (
                                <span className="text-gray-400"> 等{q.products.length}项</span>
                              )}
                            </span>
                          ))}
                          {q.products.length === 2 && (
                            <span>{q.products[1].name} ×{q.products[1].qty}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Right side: amount + arrow */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="font-bold text-base tabular-nums">
                          {CURRENCY_SYMBOL[q.currency] || q.currency}{' '}
                          {q.total_amount_foreign.toFixed(2)}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
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
