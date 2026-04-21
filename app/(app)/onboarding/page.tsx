'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Landmark, Rocket, CheckCircle2, ChevronRight, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserProfile } from '@/contexts/UserProfileContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyForm {
  company_name: string
  company_name_cn: string
  address: string
  phone: string
  email: string
  website: string
}

interface BankForm {
  bank_beneficiary: string
  bank_name: string
  bank_account: string
  bank_swift: string
}

const STEPS = [
  { id: 1, label: '公司信息', icon: Building2 },
  { id: 2, label: '银行信息', icon: Landmark },
  { id: 3, label: '完成',     icon: Rocket },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { refreshProfile } = useUserProfile()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [company, setCompany] = useState<CompanyForm>({
    company_name: '',
    company_name_cn: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  })

  const [bank, setBank] = useState<BankForm>({
    bank_beneficiary: '',
    bank_name: '',
    bank_account: '',
    bank_swift: '',
  })

  // ── Helpers ────────────────────────────────────────────────────────────────

  const patch = <T extends object>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (field: keyof T) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setter(prev => ({ ...prev, [field]: e.target.value }))

  const patchCompany = patch(setCompany)
  const patchBank    = patch(setBank)

  const saveAll = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...company, ...bank }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '保存失败')
      await refreshProfile()
    } catch (err: any) {
      toast.error(err.message || '保存失败，请重试')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleStep1Next = () => {
    if (!company.company_name.trim()) {
      toast.error('请填写公司名称')
      return
    }
    setStep(2)
  }

  const handleStep2Next = async (skip = false) => {
    try {
      await saveAll()
      setStep(3)
    } catch { /* error already toasted */ }
  }

  const handleFinish = () => {
    router.replace('/quote')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-lg">

        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">欢迎使用 LeadSpark</h1>
          <p className="text-gray-500 mt-1 text-sm">2 分钟完成设置，之后报价/PI/CI 自动带入公司信息</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, i) => {
            const done    = step > s.id
            const current = step === s.id
            const Icon    = s.icon
            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`
                    w-9 h-9 rounded-full flex items-center justify-center transition-all
                    ${done    ? 'bg-blue-600 text-white'
                    : current ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    :           'bg-gray-100 text-gray-400'}
                  `}>
                    {done
                      ? <CheckCircle2 className="w-5 h-5" />
                      : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-medium ${current ? 'text-blue-600' : done ? 'text-gray-500' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 mb-5 mx-1 transition-all ${done ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* ── Step 1: Company Info ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  公司基本信息
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">将出现在报价单、PI、CI 的抬头</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    公司英文名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Your Company Ltd."
                    value={company.company_name}
                    onChange={patchCompany('company_name')}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">公司中文名称（可选）</label>
                  <Input
                    placeholder="贵公司有限公司"
                    value={company.company_name_cn}
                    onChange={patchCompany('company_name_cn')}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">地址（可选）</label>
                  <Input
                    placeholder="123 Trade Road, Guangzhou, China"
                    value={company.address}
                    onChange={patchCompany('address')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">电话</label>
                    <Input
                      placeholder="+86 20 1234 5678"
                      value={company.phone}
                      onChange={patchCompany('phone')}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">邮箱</label>
                    <Input
                      type="email"
                      placeholder="sales@company.com"
                      value={company.email}
                      onChange={patchCompany('email')}
                    />
                  </div>
                </div>
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-2" onClick={handleStep1Next}>
                下一步
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Bank Info ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-blue-500" />
                  银行收款信息
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">生成 PI 时自动填入银行信息，方便客户付款</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">收款人（Beneficiary）</label>
                  <Input
                    placeholder="Your Company Ltd."
                    value={bank.bank_beneficiary}
                    onChange={patchBank('bank_beneficiary')}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">银行名称</label>
                  <Input
                    placeholder="Bank of China"
                    value={bank.bank_name}
                    onChange={patchBank('bank_name')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">账号</label>
                    <Input
                      placeholder="1234567890"
                      value={bank.bank_account}
                      onChange={patchBank('bank_account')}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">SWIFT Code</label>
                    <Input
                      placeholder="BKCHCNBJ"
                      value={bank.bank_swift}
                      onChange={patchBank('bank_swift')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <Button
                  variant="outline"
                  className="flex-1 text-gray-500"
                  onClick={() => handleStep2Next(true)}
                  disabled={saving}
                >
                  稍后再填
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleStep2Next(false)}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  完成设置
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && (
            <div className="space-y-6 text-center">
              <div>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">设置完成！</h2>
                <p className="text-gray-500 text-sm mt-1">公司信息已保存，可以开始使用了</p>
              </div>

              {/* Next steps checklist */}
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">接下来可以做</p>
                {[
                  { icon: '📦', text: '在「产品库」添加你的产品和成本价' },
                  { icon: '💰', text: '用「报价计算器」生成第一张报价单' },
                  { icon: '👥', text: '在「客户」页面管理买家信息' },
                  { icon: '🚢', text: '出货后用「CI/PL 生成」制作商业发票' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base"
                onClick={handleFinish}
              >
                开始使用
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {step < 3 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            所有信息可在「企业资料」中随时修改
          </p>
        )}
      </div>
    </div>
  )
}
