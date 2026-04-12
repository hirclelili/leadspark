'use client'

import Link from 'next/link'
import { Calculator, Package, Users, Settings, TrendingUp, FileText, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'

interface Stats {
  totalProducts: number
  totalCustomers: number
  totalQuotations: number
  customersByStatus: {
    new: number
    quoted: number
    negotiating: number
    won: number
    lost: number
  }
}

interface DashboardClientProps {
  companyName: string
  stats: Stats
  recentQuotations: any[]
  monthlyData: { month: string; total: number }[]
  quotesByStatus: { name: string; value: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  '草稿': '#9ca3af',
  '已发送': '#3b82f6',
  '议价中': '#f59e0b',
  '已成交': '#22c55e',
  '已流失': '#ef4444',
}

export function DashboardClient({
  companyName,
  stats,
  recentQuotations,
  monthlyData,
  quotesByStatus,
}: DashboardClientProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
    })
  }

  const hasChartData = monthlyData.some((d) => d.total > 0)

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作台</h1>
          <p className="text-gray-500">欢迎回来，{companyName || '用户'}！</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/quote">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Calculator className="w-6 h-6 text-blue-600" />
              </div>
              <span className="font-medium">报价计算</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/products">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <span className="font-medium">产品库</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/customers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <span className="font-medium">客户管理</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
              <span className="font-medium">设置</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">数据概览</CardTitle>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">产品数</span>
                <span className="font-medium">{stats.totalProducts} 个</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">客户数</span>
                <span className="font-medium">{stats.totalCustomers} 个</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">报价记录</span>
                <span className="font-medium">{stats.totalQuotations} 次</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Status */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>客户状态分布</CardTitle>
            <CardDescription>各状态客户数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-700">{stats.customersByStatus.new}</div>
                <div className="text-xs text-blue-600">新客户</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-700">{stats.customersByStatus.quoted}</div>
                <div className="text-xs text-yellow-600">已报价</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-xl font-bold text-orange-700">{stats.customersByStatus.negotiating}</div>
                <div className="text-xs text-orange-600">谈判中</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-700">{stats.customersByStatus.won}</div>
                <div className="text-xs text-green-600">已成交</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-700">{stats.customersByStatus.lost}</div>
                <div className="text-xs text-gray-600">已流失</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              报价趋势（近6个月）
            </CardTitle>
            <CardDescription>各月外币报价金额合计</CardDescription>
          </CardHeader>
          <CardContent>
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, '金额']}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
                近6个月暂无报价数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote status distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-purple-500" />
              报价状态分布
            </CardTitle>
            <CardDescription>近6个月各状态报价数量</CardDescription>
          </CardHeader>
          <CardContent>
            {quotesByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={quotesByStatus}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [Number(v), '报价数']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {quotesByStatus.map((entry, index) => (
                      <Cell key={index} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
                近6个月暂无报价数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>最近报价</CardTitle>
            <CardDescription>最近的报价记录</CardDescription>
          </div>
          <Link href="/quote/history">
            <Button variant="outline" size="sm">
              查看全部
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentQuotations.length > 0 ? (
            <div className="space-y-3">
              {recentQuotations.slice(0, 5).map((quote: any) => (
                <div key={quote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{quote.quotation_number}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      {quote.trade_term} · {quote.customers?.company_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">
                      {quote.currency} {quote.total_amount_foreign?.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(quote.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-6">
              暂无报价记录，
              <Link href="/quote" className="text-blue-600 hover:underline">
                立即报价
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
