'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Calculator, Package, Users, Building2, TrendingUp, FileText, ArrowRight, Bell, CheckCircle2, Plus, Sparkles, AlertTriangle, Copy, Check, Loader2 } from 'lucide-react'
import { formatDateShort } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AddTaskDialog, type Task } from '@/components/AddTaskDialog'
import { toast } from 'sonner'
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

interface ExpiringQuote {
  id: string
  quotation_number: string
  daysLeft: number
  customers?: { company_name: string } | null
}

interface DashboardClientProps {
  companyName: string
  stats: Stats
  recentQuotations: any[]
  monthlyData: { month: string; total: number }[]
  quotesByStatus: { name: string; value: number }[]
  expiringQuotes: ExpiringQuote[]
}

function AiFollowUpPanel({ quotationId, onClose }: { quotationId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const generate = async () => {
      try {
        const res = await fetch('/api/ai/follow-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quotation_id: quotationId, follow_up_type: 'quote_expiry' }),
        })
        const data = await res.json()
        if (data.error) { toast.error(data.error); onClose(); return }
        setResult(data)
      } catch {
        toast.error('生成失败，请重试')
        onClose()
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [quotationId, onClose])

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('已复制到剪贴板')
  }

  return (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
      {loading ? (
        <div className="flex items-center gap-2 text-blue-600 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>AI 正在起草邮件...</span>
        </div>
      ) : result ? (
        <div className="space-y-2">
          <div>
            <span className="text-xs text-blue-500 font-medium uppercase tracking-wide">主题</span>
            <p className="font-medium text-gray-800 mt-0.5">{result.subject}</p>
          </div>
          <div>
            <span className="text-xs text-blue-500 font-medium uppercase tracking-wide">正文</span>
            <pre className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{result.body}</pre>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-green-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? '已复制' : '复制邮件'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function InsightsWidget({ expiringQuotes, overdueCount }: { expiringQuotes: ExpiringQuote[]; overdueCount: number }) {
  const [openPanel, setOpenPanel] = useState<string | null>(null)

  const hasInsights = expiringQuotes.length > 0 || overdueCount > 0
  if (!hasInsights) return null

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-base">AI 待处理事项</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {expiringQuotes.map((q) => (
          <div key={q.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">{q.quotation_number}</span>
                  {q.customers?.company_name && (
                    <span className="text-gray-500">（{q.customers.company_name}）</span>
                  )}
                  <span className="text-amber-600 ml-1">
                    {q.daysLeft === 0 ? '今天到期' : `${q.daysLeft} 天后到期`}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-shrink-0 border-amber-300 hover:bg-amber-100"
                onClick={() => setOpenPanel(openPanel === q.id ? null : q.id)}
              >
                <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                {openPanel === q.id ? '收起' : 'AI 起草'}
              </Button>
            </div>
            {openPanel === q.id && (
              <AiFollowUpPanel quotationId={q.id} onClose={() => setOpenPanel(null)} />
            )}
          </div>
        ))}

        {overdueCount > 0 && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm">
                <span className="font-medium text-red-600">{overdueCount} 项</span>
                <span className="text-gray-600"> 跟进提醒已逾期</span>
              </span>
            </div>
            <Link href="/tasks">
              <Button size="sm" variant="outline" className="h-7 text-xs">
                查看任务
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function dueBadgeClass(dateStr: string) {
  const today = getTodayStr()
  if (dateStr < today) return 'bg-red-100 text-red-600'
  if (dateStr === today) return 'bg-orange-100 text-orange-600'
  return 'bg-gray-100 text-gray-500'
}

function formatDueDateShort(dateStr: string) {
  const today = getTodayStr()
  const [, mm, dd] = dateStr.split('-')
  if (dateStr === today) return '今天'
  if (dateStr < today) return `逾期 ${mm}/${dd}`
  return `${mm}/${dd}`
}

function TasksWidget({ onOverdueCount }: { onOverdueCount?: (n: number) => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks?status=pending&limit=10')
      const data = await res.json()
      if (!data.error) {
        setTasks(data.tasks || [])
        setOverdueCount(data.overdue_count || 0)
        onOverdueCount?.(data.overdue_count || 0)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTasks() }, [])

  const displayTasks = tasks.slice(0, 3)

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-base">待处理跟进</CardTitle>
            {overdueCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                {overdueCount} 项已逾期
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              添加提醒
            </Button>
            <Link href="/tasks">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                查看全部
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400 py-2">加载中...</p>
          ) : displayTasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">
              暂无待处理提醒 · 从报价或客户页面添加
            </p>
          ) : (
            <div className="space-y-2">
              {displayTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${dueBadgeClass(task.due_date)}`}>
                    {formatDueDateShort(task.due_date)}
                  </span>
                </div>
              ))}
              {tasks.length > 3 && (
                <Link href="/tasks" className="text-xs text-blue-500 hover:underline block pt-1">
                  还有 {tasks.length - 3} 条提醒
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(task) => {
          setTasks((prev) => [task, ...prev])
        }}
      />
    </>
  )
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
  expiringQuotes,
}: DashboardClientProps) {
  const hasChartData = monthlyData.some((d) => d.total > 0)
  const [overdueCount, setOverdueCount] = useState(0)

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

      {/* AI Insights Widget */}
      <InsightsWidget expiringQuotes={expiringQuotes} overdueCount={overdueCount} />

      {/* Tasks Widget */}
      <TasksWidget onOverdueCount={setOverdueCount} />

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
                <Building2 className="w-6 h-6 text-gray-600" />
              </div>
              <span className="font-medium">企业资料</span>
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
                      {formatDateShort(quote.created_at)}
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
