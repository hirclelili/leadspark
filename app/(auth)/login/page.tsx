'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('邮箱或密码错误，请重试')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold">LeadSpark</span>
          </div>
          <h2 className="text-2xl font-semibold mb-4 leading-snug">
            SOHO 外贸人的智能报价助理
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            一键算出 EXW / FOB / CIF 等 11 种贸易术语报价，
            生成专业英文 PDF 报价单，管理客户跟进记录。
          </p>
          <div className="mt-10 space-y-3 text-left">
            {[
              '实时汇率，报价更准确',
              '专业 PDF 报价单，客户更信任',
              '客户历史报价一目了然',
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-blue-100">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs">✓</span>
                </div>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LeadSpark</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">欢迎回来</h1>
          <p className="text-gray-500 text-sm mb-8">登录您的账户继续使用</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                密码
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? '登录中...' : (
                <span className="flex items-center justify-center gap-2">
                  登录
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            还没有账户？{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              免费注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
