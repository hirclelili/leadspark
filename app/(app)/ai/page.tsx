'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Sparkles, Send, Loader2, FileSearch, Mail, MessageSquare, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/contexts/UserProfileContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
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

  useEffect(() => {
    loadContext()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Re-initialize welcome message once profile loads (context may arrive after mount)
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
      // Use profile from context if available; otherwise fall back to a quick fetch
      const company = userProfile?.company_name || '您的公司'
      const productsRes = await fetch('/api/products?limit=20')
      const productsData = productsRes.ok ? await productsRes.json() : null
      const productCount = productsData?.products?.length || 0
      setContextInfo(`${company} · 已加载 ${productCount} 个产品`)

      // Welcome message
      setMessages([
        {
          role: 'assistant',
          content: `您好！我是 ${company} 的 AI 销售助手 ✨\n\n我已加载您的公司信息和产品目录（${productCount} 个产品），可以帮您：\n\n• **解析询盘邮件** — 自动提取产品、数量、贸易术语等关键信息\n• **起草报价邮件** — 生成专业的英文报价回复\n• **议价回复** — 帮您处理客户还价，维护利润空间\n• **贸易咨询** — 解答关税、Incoterms、付款方式等问题\n\n点击下方快捷指令，或直接输入您的问题开始吧！`,
        },
      ])
    } catch {
      setContextInfo('加载上下文失败')
    }
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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '请求失败')
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '发送失败，请重试')
      // Remove the user message on error
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

  // Simple markdown-like rendering for bold and line breaks
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
        <Button variant="ghost" size="sm" className="text-xs text-gray-400" onClick={loadContext}>
          重新加载上下文
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white flex-shrink-0 overflow-x-auto">
        <span className="text-xs text-gray-400 flex-shrink-0">快捷指令：</span>
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
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
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
