'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, Upload, Loader2, Pencil, X, Check, CreditCard, Globe, Hash, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserProfile } from '@/contexts/UserProfileContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { CURRENCY_OPTIONS } from '@/lib/currencies'
import { previewNextDocNumber } from '@/lib/docNumber.shared'
import type { DocNumberConfig, YearFormat } from '@/lib/docNumber.shared'

interface UserProfile {
  id?: string
  company_name?: string
  company_name_cn?: string
  logo_url?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  default_currency?: string
  default_payment_terms?: string
  default_validity?: number
  bank_name?: string
  bank_account?: string
  bank_swift?: string
  bank_beneficiary?: string
}

const currencies = CURRENCY_OPTIONS

const paymentTermsOptions = [
  { value: 'T/T 30% deposit, 70% before shipment', label: 'T/T 30% 定金，70% 出货前付清' },
  { value: 'T/T 50% deposit, 50% before shipment', label: 'T/T 50% 定金，50% 出货前付清' },
  { value: 'T/T 100% before shipment', label: 'T/T 100% 出货前付清' },
  { value: 'L/C at sight', label: 'L/C 即期' },
  { value: 'L/C 30 days', label: 'L/C 30天' },
  { value: 'D/P at sight', label: 'D/P 即期' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Western Union', label: '西联汇款' },
]

const emptyForm = {
  company_name: '',
  company_name_cn: '',
  logo_url: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  default_currency: 'USD',
  default_payment_terms: 'T/T 30% deposit, 70% before shipment',
  default_validity: 30,
  bank_name: '',
  bank_account: '',
  bank_swift: '',
  bank_beneficiary: '',
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-800">{value || <span className="text-gray-300 italic">未填写</span>}</div>
    </div>
  )
}

export function SettingsClient() {
  const { refreshProfile } = useUserProfile()
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  const supabase = createClient()
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user-profile')
      const data = await res.json()
      if (data && !data.error) {
        setProfile(data)
        setFormData({
          company_name: data.company_name || '',
          company_name_cn: data.company_name_cn || '',
          logo_url: data.logo_url || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          default_currency: data.default_currency || 'USD',
          default_payment_terms: data.default_payment_terms || 'T/T 30% deposit, 70% before shipment',
          default_validity: data.default_validity || 30,
          bank_name: data.bank_name || '',
          bank_account: data.bank_account || '',
          bank_swift: data.bank_swift || '',
          bank_beneficiary: data.bank_beneficiary || '',
        })
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form to last saved state
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        company_name_cn: profile.company_name_cn || '',
        logo_url: profile.logo_url || '',
        address: profile.address || '',
        phone: profile.phone || '',
        email: profile.email || '',
        website: profile.website || '',
        default_currency: profile.default_currency || 'USD',
        default_payment_terms: profile.default_payment_terms || 'T/T 30% deposit, 70% before shipment',
        default_validity: profile.default_validity || 30,
        bank_name: profile.bank_name || '',
        bank_account: profile.bank_account || '',
        bank_swift: profile.bank_swift || '',
        bank_beneficiary: profile.bank_beneficiary || '',
      })
    }
    setEditing(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Basic client-side size check (2 MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片不能超过 2 MB')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, {
        upsert: false,
        contentType: file.type,
      })
      if (uploadError) {
        toast.error('上传失败: ' + uploadError.message)
        return
      }

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      // Immediately persist the new logo URL to the database — don't rely on user clicking 保存
      const updatedFormData = { ...formData, logo_url: publicUrl }
      setFormData(updatedFormData)

      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFormData),
      })
      if (!res.ok) {
        toast.warning('Logo 已上传，但自动保存失败，请手动点击「保存」')
      } else {
        const saved = await res.json()
        setProfile(saved)
        await refreshProfile()
        toast.success('Logo 已上传并保存')
      }
    } catch (err) {
      toast.error('上传失败，请检查网络连接')
    } finally {
      setUploading(false)
      // Reset input so same file can be re-selected
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!formData.company_name?.trim()) {
      toast.error('公司名称（英文）不能为空')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        console.error('[Settings] Save failed:', res.status, data)
        toast.error('保存失败: ' + (data.error || `HTTP ${res.status}`))
      } else {
        setProfile(data)
        await refreshProfile()
        setEditing(false)
        toast.success('保存成功')
      }
    } catch (err) {
      console.error('[Settings] Save error:', err)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(f => ({ ...f, [key]: e.target.value }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-8 pt-16 md:pt-8 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">企业资料</h1>
            <p className="text-sm text-gray-500 mt-0.5">用于报价单、CI/PL 等单据的抬头和落款</p>
          </div>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            编辑
          </Button>
        )}
      </div>

      {/* Company Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" /> 公司信息
          </CardTitle>
          <CardDescription>公司名称、地址、联系方式将打印在单据抬头</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
              {formData.logo_url
                ? <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                : <Building2 className="w-7 h-7 text-gray-300" />}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">公司 Logo</div>
              {editing ? (
                <>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} className="sr-only" />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => logoInputRef.current?.click()}>
                    {uploading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />上传中…</> : <><Upload className="mr-1.5 h-3.5 w-3.5" />上传 Logo</>}
                  </Button>
                  <p className="text-xs text-gray-400 mt-1">PNG / JPG，建议 200×200</p>
                </>
              ) : (
                <div className="text-xs text-gray-400">{formData.logo_url ? '已上传' : '未上传'}</div>
              )}
            </div>
          </div>

          {/* Names */}
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">公司名称（英文）<span className="text-red-500">*</span></label>
                <Input value={formData.company_name} onChange={set('company_name')} placeholder="ABC Trading Co., Ltd." />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">公司名称（中文）</label>
                <Input value={formData.company_name_cn} onChange={set('company_name_cn')} placeholder="ABC 贸易有限公司" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="公司名称（英文）" value={formData.company_name} />
              <Field label="公司名称（中文）" value={formData.company_name_cn} />
            </div>
          )}

          {/* Address */}
          {editing ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">公司地址</label>
              <Input value={formData.address} onChange={set('address')} placeholder="No. 123, XXX Road, City, Country" />
            </div>
          ) : (
            <Field label="公司地址" value={formData.address} />
          )}

          {/* Contact */}
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">电话</label>
                <Input value={formData.phone} onChange={set('phone')} placeholder="+86 123 4567 8900" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">邮箱</label>
                <Input type="email" value={formData.email} onChange={set('email')} placeholder="sales@example.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">网站</label>
                <Input value={formData.website} onChange={set('website')} placeholder="https://www.example.com" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="电话" value={formData.phone} />
              <Field label="邮箱" value={formData.email} />
              <Field label="网站" value={formData.website} />
            </div>
          )}

          {/* Defaults */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-600">报价单默认值</div>
              <div className="text-xs text-gray-400">每次新建报价单时自动填入</div>
            </div>
            {editing ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">默认货币</label>
                  <Select value={formData.default_currency} onValueChange={v => setFormData(f => ({ ...f, default_currency: v ?? 'USD' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{currencies.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium">默认付款条件</label>
                  <Select value={formData.default_payment_terms} onValueChange={v => setFormData(f => ({ ...f, default_payment_terms: v ?? '' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{paymentTermsOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">报价有效天数</label>
                  <Select value={String(formData.default_validity)} onValueChange={v => setFormData(f => ({ ...f, default_validity: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[7, 14, 30, 60, 90].map(n => <SelectItem key={n} value={String(n)}>{n} 天</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="默认货币" value={formData.default_currency} />
                <Field label="报价有效天数" value={formData.default_validity ? `${formData.default_validity} 天` : undefined} />
                <Field label="默认付款条件" value={formData.default_payment_terms} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bank Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> 银行收款信息
          </CardTitle>
          <CardDescription>显示在 PI / CI 单据底部，方便客户付款</CardDescription>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">收款行名称</label>
                <Input value={formData.bank_name} onChange={set('bank_name')} placeholder="Bank of China / 中国银行" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">收款人名称</label>
                <Input value={formData.bank_beneficiary} onChange={set('bank_beneficiary')} placeholder="ABC Trading Co., Ltd." />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">银行账号</label>
                <Input value={formData.bank_account} onChange={set('bank_account')} placeholder="1234 5678 9012 3456" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">SWIFT / BIC Code</label>
                <Input value={formData.bank_swift} onChange={set('bank_swift')} placeholder="BKCHCNBJ" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="收款行名称" value={formData.bank_name} />
              <Field label="收款人名称" value={formData.bank_beneficiary} />
              <Field label="银行账号" value={formData.bank_account} />
              <Field label="SWIFT / BIC Code" value={formData.bank_swift} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action bar — only visible in edit mode */}
      {editing && (
        <div className="flex items-center gap-3 pt-2 border-t">
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中…</> : <><Check className="mr-2 h-4 w-4" />保存</>}
          </Button>
          <Button variant="ghost" onClick={handleCancel} disabled={saving}>
            <X className="mr-1.5 h-4 w-4" />取消
          </Button>
        </div>
      )}

      {/* ── Document Number Settings ── */}
      <DocNumberSettings />
    </div>
  )
}

// ─── DocNumberSettings (self-contained sub-component) ────────────────────────

const DOC_LABELS: Record<string, string> = {
  Q:  '报价单 (Quotation)',
  PI: 'PI 形式发票',
  CI: 'CI 商业发票',
}

const YEAR_FORMAT_OPTIONS: { value: YearFormat; label: string; example: string }[] = [
  { value: 'YYYY',     label: '完整年份', example: '2026' },
  { value: 'YY',       label: '两位年份', example: '26' },
  { value: 'YYYYMMDD', label: '年月日',   example: '20260421' },
  { value: 'none',     label: '不含年份', example: '—' },
]

function DocNumberSettings() {
  const [configs, setConfigs] = useState<DocNumberConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/doc-number')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setConfigs(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const patch = (docType: string, field: keyof DocNumberConfig, value: unknown) =>
    setConfigs(prev => prev.map(c => c.doc_type === docType ? { ...c, [field]: value } : c))

  const handleSave = async (cfg: DocNumberConfig) => {
    setSaving(cfg.doc_type)
    try {
      const res = await fetch('/api/doc-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      toast.success(`${DOC_LABELS[cfg.doc_type] || cfg.doc_type} 编号格式已保存`)
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async (docType: string) => {
    if (!confirm(`确定要将「${DOC_LABELS[docType]}」的序号重置为 0 吗？\n下一张单据将从 001 开始编号。`)) return
    setResetting(docType)
    try {
      const res = await fetch('/api/doc-number', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: docType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setConfigs(prev => prev.map(c => c.doc_type === docType ? { ...c, current_seq: 0, current_year: 0 } : c))
      toast.success('序号已重置')
    } catch (err: any) {
      toast.error(err.message || '重置失败')
    } finally {
      setResetting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="w-5 h-5" />
          单据编号
        </CardTitle>
        <CardDescription>自定义报价单、PI、CI 的编号前缀和格式，系统自动递增序号</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载中…
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map(cfg => {
              const preview = previewNextDocNumber(cfg)
              const isSaving   = saving   === cfg.doc_type
              const isResetting = resetting === cfg.doc_type
              return (
                <div key={cfg.doc_type} className="rounded-lg border p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      {DOC_LABELS[cfg.doc_type] || cfg.doc_type}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        当前序号：<span className="font-mono font-medium text-gray-600">{cfg.current_seq}</span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-40"
                        onClick={() => handleReset(cfg.doc_type)}
                        disabled={!!isResetting}
                        title="重置序号至 0"
                      >
                        {isResetting
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <RotateCcw className="w-3 h-3" />}
                        重置
                      </button>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">前缀</label>
                      <Input
                        className="h-8 text-sm font-mono"
                        value={cfg.prefix}
                        maxLength={10}
                        onChange={e => patch(cfg.doc_type, 'prefix', e.target.value.toUpperCase())}
                        placeholder="Q"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">年份格式</label>
                      <Select
                        value={cfg.year_format}
                        onValueChange={v => patch(cfg.doc_type, 'year_format', v as YearFormat)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YEAR_FORMAT_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                              <span className="ml-1 text-gray-400 text-xs">({o.example})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">序号位数</label>
                      <Select
                        value={String(cfg.digits)}
                        onValueChange={v => patch(cfg.doc_type, 'digits', Number(v))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={String(n)}>{n} 位</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">按年重置</label>
                      <button
                        type="button"
                        className={`h-8 w-full rounded-md border text-sm font-medium transition-colors ${
                          cfg.reset_yearly
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                        onClick={() => patch(cfg.doc_type, 'reset_yearly', !cfg.reset_yearly)}
                      >
                        {cfg.reset_yearly ? '✓ 每年重置' : '不重置'}
                      </button>
                    </div>
                  </div>

                  {/* Preview + save */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-gray-500">
                      下一张预览：
                      <span className="ml-1.5 font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {preview}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleSave(cfg)}
                      disabled={!!isSaving}
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      保存格式
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
