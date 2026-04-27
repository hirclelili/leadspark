'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, Sparkles, Send, Loader2, FileSearch, Mail, MessageSquare, User, Link2, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/contexts/UserProfileContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface CustomerOption {
  id: string
  company_name: string
  contact_name?: string
  status?: string
}

interface QuotationOption {
  id: string
  quotation_number: string
  document_kind?: string
  currency?: string
  total_amount_foreign?: number
}

const QUICK_ACTIONS = [
  {
    icon: FileSearch,
    label: '解析询盘',
    color: 'text-blue-600',
    bg: 'bg-blue-50 hover:bg-blue-100',
    prompt: '请帮我解析以下询盘邮件，提取产品名称、数量、规格、贸易术语等关键信息：\n\n',
  },
  {
    icon: Mail,
    label: '生成报价邮件',
    color: 'text-green-600',
    bg: 'bg-green-50 hover:bg-green-100',
    prompt: '请帮我起草一封专业的英文报价回复邮件。客户信息和报价内容如下：\n\n',
  },
  {
    icon: MessageSquare,
    label: '议价回复',
    color: 'text-orange-600',
    bg: 'bg-orange-50 hover:bg-orange-100',
    prompt: '客户对我们的报价进行了还价，请帮我生成一封专业的议价回复邮件。客户消息如下：\n\n',
  },
  {
    icon: Sparkles,
    label: '自由提问',
    color: 'text-purple-600',
    bg: 'bg-purple-50 hover:bg-purple-100',
    prompt: '',
  },
]

export default function AiPage() {
  const { profile: userProfile } = useUserProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextInfo, setContextInfo] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initializedRef = useRef(false)

  // Bound context
  const [boundCustomer, setBoundCustomer] = useState<CustomerOption | null>(null)
  const [boundQuotation, setBoundQuotation] = useState<QuotationOption | null>(null)
  const [showContextPanel, setShowContextPanel] = useState(false)

  // Context panel data
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [quotations, setQuotations] = useState<QuotationOption[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingQuotations, setLoadingQuotations] = useState(false)

  useEffect(() => { loadContext() }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (userProfile && !initializedRef.current && messages.length > 0) {
      initializedRef.current = true
      const company = userProfile.company_name || '您的公司'
      setMessages(prev => [
        { ...prev[0], content: prev[0].content.replace(/您的公司|.+(?= 的 AI)/, company) },
        ...prev.slice(1),
      ])
      setContextInfo(prev => prev.replace(/您的公司|^[^·]+/, company))
    }
  }, [userProfile])

  const loadContext = async () => {
    try {
      const company = userProfile?.company_name || '您的公司'
      const productsRes = await fetch('/api/products?limit=50')
      const productsData = productsRes.ok ? await productsRes.json() : null
      const productCount = productsData?.products?.length || 0
      setContextInfo(`${company} · ${productCount} 个产品`)
      setMessages([{
        role: 'assistant',
        content: `您好！我是 ${company} 的 AI 销售助手 ✨\n\n我已加载您的公司信息和产品目录（${productCount} 个产品），可以帮您：\n\n• **解析询盘邮件** — 自动提取产品、数量、贸易术语等关键信息\n• **起草报价邮件** — 生成专业的英文报价回复\n• **议价回复** — 帮您处理客户还价，维护利润空间\n• **贸易咨询** — 解答关税、Incoterms、付款方式等问题\n\n💡 点击右上角"绑定上下文"可关联具体客户或报价单，让回答更有针对性。`,
      }])
    } catch {
      setContextInfo('加载上下文失败')
    }
  }

  const fetchCustomers = useCallback(async (search = '') => {
    setLoadingCustomers(true)
    try {
      const url = search
        ? `/api/customers?search=${encodeURIComponent(search)}&limit=20`
        : `/api/customers?limit=20`
      const res = await fetch(url)
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch { /* silent */ } finally {
      setLoadingCustomers(false)
    }
  }, [])

  const fetchQuotations = useCallback(async (customerId?: string) => {
    setLoadingQuotations(true)
    try {
      const url = customerId
        ? `/api/quotations?customer_id=${customerId}&limit=10`
        : `/api/quotations?limit=10`
      const res = await fetch(url)
      const data = await res.json()
      setQuotations(data.quotations || [])
    } catch { /* silent */ } finally {
      setLoadingQuotations(false)
    }
  }, [])

  const openContextPanel = () => {
    setShowContextPanel(true)
    fetchCustomers()
    if (boundCustomer) fetchQuotations(boundCustomer.id)
    else fetchQuotations()
  }

  const handleSelectCustomer = (c: CustomerOption | null) => {
    setBoundCustomer(c)
    setBoundQuotation(null)
    if (c) fetchQuotations(c.id)
    else fetchQuotations()
    // Inject a context change notice into chat
    if (c) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ 已绑定客户：**${c.company_name}**${c.contact_name ? `（联系人：${c.contact_name}）` : ''}。接下来的对话我会结合该客户的历史报价和备注记录给出有针对性的建议。`,
      }])
    }
  }

  const handleSelectQuotation = (q: QuotationOption | null) => {
    setBoundQuotation(q)
    if (q) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ 已绑定报价单：**${q.quotation_number}**${q.total_amount_foreign ? `（${q.currency} ${q.total_amount_foreign.toFixed(2)}）` : ''}。接下来我可以针对这份报价单回答问题、起草跟进邮件或协助议价。`,
      }])
    }
  }

  const clearContext = () => {
    setBoundCustomer(null)
    setBoundQuotation(null)
    setShowContextPanel(false)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          customer_id: boundCustomer?.id,
          quotation_id: boundQuotation?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '请求失败')
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '发送失败，请重试')
      setMessages((prev) => prev.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
          {i < content.split('\n').length - 1 && <br />}
        </span>
      )
    })
  }

  const hasBoundContext = boundCustomer || boundQuotation

  return (
    <div className="flex flex-col h-screen pt-16 md:pt-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">AI 销售助手</h1>
            {contextInfo && <p className="text-xs text-gray-500">{contextInfo}</p>}
          </div>
        </div>
        <Button
          variant={hasBoundContext ? 'default' : 'outline'}
          size="sm"
          className={cn('text-xs gap-1.5', hasBoundContext && 'bg-blue-600 hover:bg-blue-700')}
          onClick={openContextPanel}
        >
          <Link2 className="w-3.5 h-3.5" />
          {hasBoundContext ? '已绑定上下文' : '绑定上下文'}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </div>

      {/* Bound context chips */}
      {hasBoundContext && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b text-xs">
          <span className="text-blue-400">上下文：</span>
          {boundCustomer && (
            <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              👤 {boundCustomer.company_name}
              <button onClick={() => { setBoundCustomer(null); setBoundQuotation(null) }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {boundQuotation && (
            <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              📄 {boundQuotation.quotation_number}
              <button onClick={() => setBoundQuotation(null)} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button onClick={clearContext} className="ml-auto text-gray-400 hover:text-gray-600">
            清除全部
          </button>
        </div>
      )}

      {/* Context binding panel */}
      {showContextPanel && (
        <div className="flex-shrink-0 border-b bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">绑定上下文</h3>
            <button onClick={() => setShowContextPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Customer selector */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">绑定客户</label>
              <input
                type="text"
                placeholder="搜索客户名称..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  fetchCustomers(e.target.value)
                }}
                className="w-full h-8 text-xs px-2.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-1.5"
              />
              <div className="max-h-36 overflow-y-auto rounded-md border bg-white divide-y">
                <button
                  onClick={() => handleSelectCustomer(null)}
                  className={cn('w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50', !boundCustomer && 'bg-gray-50 text-gray-400')}
                >
                  不绑定客户
                </button>
                {loadingCustomers ? (
                  <div className="px-2.5 py-2 text-xs text-gray-400 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />加载中...
                  </div>
                ) : customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { handleSelectCustomer(c); setShowContextPanel(false) }}
                    className={cn('w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50', boundCustomer?.id === c.id && 'bg-blue-50 text-blue-700')}
                  >
                    <div className="font-medium">{c.company_name}</div>
                    {c.contact_name && <div className="text-gray-400">{c.contact_name}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Quotation selector */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">
                绑定报价单{boundCustomer ? `（${boundCustomer.company_name}）` : ''}
              </label>
              <div className="max-h-[9.5rem] overflow-y-auto rounded-md border bg-white divide-y mt-[1.875rem]">
                <button
                  onClick={() => { setBoundQuotation(null) }}
                  className={cn('w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50', !boundQuotation && 'bg-gray-50 text-gray-400')}
                >
                  不绑定报价单
                </button>
                {loadingQuotations ? (
                  <div className="px-2.5 py-2 text-xs text-gray-400 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />加载中...
                  </div>
                ) : quotations.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-gray-400">暂无报价单</div>
                ) : quotations.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => { handleSelectQuotation(q); setShowContextPanel(false) }}
                    className={cn('w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50', boundQuotation?.id === q.id && 'bg-blue-50 text-blue-700')}
                  >
                    <div className="font-medium">{q.quotation_number}</div>
                    {q.total_amount_foreign && (
                      <div className="text-gray-400">{q.currency} {q.total_amount_foreign.toFixed(2)}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white flex-shrink-0 overflow-x-auto">
        <span className="text-xs text-gray-400 flex-shrink-0">快捷：</span>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleQuickAction(action.prompt)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors',
              action.bg, action.color
            )}
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
              )}
            >
              {renderContent(msg.content)}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t bg-white px-4 py-4">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <Textarea
            ref={textareaRef}
            placeholder={
              hasBoundContext
                ? `针对 ${boundCustomer?.company_name || ''}${boundQuotation ? ` · ${boundQuotation.quotation_number}` : ''} 提问...`
                : '输入消息... (Enter 发送，Shift+Enter 换行)'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="resize-none flex-1 text-sm min-h-[40px] max-h-[160px]"
            style={{ overflowY: input.split('\n').length > 4 ? 'auto' : 'hidden' }}
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} size="sm" className="h-10 px-4">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">AI 助手可能出现错误，请核实重要信息</p>
      </div>
    </div>
  )
}
