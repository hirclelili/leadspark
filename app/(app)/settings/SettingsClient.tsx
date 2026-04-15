'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Building, Upload, Loader2, Check, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserProfile } from '@/contexts/UserProfileContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

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

const currencies = [
  { value: 'USD', label: 'USD - 美元' },
  { value: 'EUR', label: 'EUR - 欧元' },
  { value: 'GBP', label: 'GBP - 英镑' },
  { value: 'JPY', label: 'JPY - 日元' },
  { value: 'AUD', label: 'AUD - 澳元' },
  { value: 'CAD', label: 'CAD - 加元' },
  { value: 'AED', label: 'AED - 迪拉姆' },
  { value: 'SGD', label: 'SGD - 新加坡元' },
  { value: 'CNY', label: 'CNY - 人民币' },
  { value: 'HKD', label: 'HKD - 港币' },
]

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

export function SettingsClient() {
  const { refreshProfile } = useUserProfile()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [formData, setFormData] = useState({
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
  })

  const supabase = createClient()
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user-profile', {
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data) {
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
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file)

      if (uploadError) {
        toast.error('上传失败: ' + uploadError.message)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)

      const logoUrl = urlData.publicUrl
      setFormData({ ...formData, logo_url: logoUrl })
      toast.success('Logo 上传成功')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
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
        console.log('[Settings] Saved profile:', data)
        setProfile(data)
        // Sync global context
        await refreshProfile()
        // Re-fetch from DB to confirm write succeeded (updates the status banner)
        await fetchProfile()
        toast.success(`保存成功${data.company_name ? ' — ' + data.company_name : ''}`)
      }
    } catch (error) {
      console.error('[Settings] Save error:', error)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6" />
        <h1 className="text-2xl font-bold">用户设置</h1>
      </div>

      {/* DB status indicator */}
      <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${profile?.company_name ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        <span className="text-base mt-0.5">{profile?.company_name ? '✅' : '⚠️'}</span>
        <div>
          <div className="font-semibold">
            {profile?.company_name
              ? `数据库已有记录：${profile.company_name}${profile.company_name_cn ? ` / ${profile.company_name_cn}` : ''}`
              : '数据库暂无公司信息，请填写后点击保存'}
          </div>
          {profile?.bank_name && (
            <div className="text-xs mt-0.5 opacity-75">银行：{profile.bank_name}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              公司信息
            </CardTitle>
            <CardDescription>
              设置公司信息，这些信息将用于生成报价单
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">公司 Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                  {formData.logo_url ? (
                    <img
                      src={formData.logo_url}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <input
                    ref={logoInputRef}
                    id="company-logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="sr-only"
                    aria-label="上传公司 Logo"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      '上传 Logo'
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">支持 PNG、JPG，建议 200x200</p>
                </div>
              </div>
            </div>

            {/* Company Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">公司名称（英文）*</label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="ABC Trading Co., Ltd."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">公司名称（中文）</label>
                <Input
                  value={formData.company_name_cn}
                  onChange={(e) => setFormData({ ...formData, company_name_cn: e.target.value })}
                  placeholder="ABC 贸易有限公司"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium">公司地址</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="No. 123, XXX Road, City, Country"
              />
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">电话</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+86 123 4567 8900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">邮箱</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sales@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">网站</label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.example.com"
                />
              </div>
            </div>

            {/* Default Settings */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 min-w-0">
              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium">默认报价货币</label>
                <Select
                  value={formData.default_currency}
                  onValueChange={(value) => {
                    if (value != null) setFormData({ ...formData, default_currency: value })
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="选择货币" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
                    {currencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium">默认付款条件</label>
                <Select
                  value={formData.default_payment_terms}
                  onValueChange={(value) => {
                    if (value != null) setFormData({ ...formData, default_payment_terms: value })
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="选择付款条件" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
                    {paymentTermsOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2 lg:col-span-2 xl:col-span-1">
                <label className="text-sm font-medium">报价有效天数</label>
                <Select
                  value={String(formData.default_validity)}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_validity: Number(value) })
                  }
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="选择天数" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
                    <SelectItem value="7">7 天</SelectItem>
                    <SelectItem value="14">14 天</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="60">60 天</SelectItem>
                    <SelectItem value="90">90 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  保存设置
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Bank Account Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              银行收款信息
            </CardTitle>
            <CardDescription>
              将显示在报价单 PDF 底部，方便客户付款
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">收款行名称</label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Bank of China, ICBC..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">收款人名称</label>
                <Input
                  value={formData.bank_beneficiary}
                  onChange={(e) => setFormData({ ...formData, bank_beneficiary: e.target.value })}
                  placeholder="ABC Trading Co., Ltd."
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">银行账号</label>
                <Input
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">SWIFT/BIC Code</label>
                <Input
                  value={formData.bank_swift}
                  onChange={(e) => setFormData({ ...formData, bank_swift: e.target.value })}
                  placeholder="BKCHCNBJ"
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  保存设置
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}