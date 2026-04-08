'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('注册失败，请重试')
      setLoading(false)
      return
    }

    // If session exists right away (email confirmation disabled), redirect to dashboard
    if (authData.session) {
      router.push('/dashboard')
    } else {
      // Email confirmation required
      setDone(true)
      setLoading(false)
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
            完全免费，立即开始
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            注册后即可使用所有功能，无需绑定信用卡。
            专为 SOHO 外贸人设计，帮你告别 Excel 报价的烦恼。
          </p>
          <div className="mt-10 space-y-3 text-left">
            {[
              '11 种贸易术语一键计算',
              '生成专业英文 PDF 报价单',
              '产品库 + 客户 CRM 一体化',
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

          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-2xl">✓</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">请验证邮箱</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                我们已向 <span className="font-medium text-gray-700">{email}</span> 发送了确认邮件，
                点击邮件中的链接即可完成注册。
              </p>
              <p className="mt-4 text-sm text-gray-400">
                已验证？{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  立即登录
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">创建免费账户</h1>
              <p className="text-gray-500 text-sm mb-8">开始您的外贸报价之旅</p>

              <form onSubmit={handleSignup} className="space-y-4">
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
                    placeholder="至少 6 位密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  disabled={loading}
                >
                  {loading ? '注册中...' : (
                    <span className="flex items-center justify-center gap-2">
                      免费注册
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
                <p className="text-xs text-gray-400 text-center">
                  注册即代表您同意我们的服务条款
                </p>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                已有账户？{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  立即登录
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
