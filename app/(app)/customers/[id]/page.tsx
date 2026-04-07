'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Building, Mail, Phone, Globe, Calendar, FileText,
  MessageSquare, Loader2, Plus, Edit, Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface Customer {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  country: string | null
  status: string
  notes: string | null
  created_at: string
}

interface Quotation {
  id: string
  quotation_number: string
  trade_term: string
  currency: string
  total_amount_foreign: number
  created_at: string
}

interface Remark {
  id: string
  content: string
  created_at: string
}

const statusOptions = [
  { value: 'new', label: '新客户' },
  { value: 'quoted', label: '已报价' },
  { value: 'negotiating', label: '谈判中' },
  { value: 'won', label: '已成交' },
  { value: 'lost', label: '已流失' },
]

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [remarks, setRemarks] = useState<Remark[]>([])

  // Edit state
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    country: '',
    status: 'new',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // Remark input
  const [remarkInput, setRemarkInput] = useState('')
  const [addingRemark, setAddingRemark] = useState(false)

  useEffect(() => {
    if (id) {
      fetchCustomer()
    }
  }, [id])

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${id}`)
      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
        router.push('/customers')
      } else {
        setCustomer(data.customer)
        setQuotations(data.quotations || [])
        setRemarks(data.remarks || [])
        setFormData({
          company_name: data.customer.company_name,
          contact_name: data.customer.contact_name || '',
          email: data.customer.email || '',
          phone: data.customer.phone || '',
          country: data.customer.country || '',
          status: data.customer.status,
          notes: data.customer.notes || '',
        })
      }
    } catch (error) {
      console.error('Error:', error)
      router.push('/customers')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('更新成功')
        setEditing(false)
        setCustomer(data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddRemark = async () => {
    if (!remarkInput.trim()) return

    setAddingRemark(true)
    try {
      const res = await fetch(`/api/customers/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: remarkInput }),
      })

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        setRemarkInput('')
        setRemarks([data, ...remarks])
        toast.success('添加成功')
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setAddingRemark(false)
    }
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('zh-CN')
  }

  const formatPrice = (price: number, currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
    }
    return `${symbols[currency] || currency}${price.toFixed(2)}`
  }

  const getStatusLabel = (s: string) => {
    const opt = statusOptions.find((o) => o.value === s)
    return opt?.label || s
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>客户信息</CardTitle>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                编辑
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false)
                    setFormData({
                      company_name: customer?.company_name || '',
                      contact_name: customer?.contact_name || '',
                      email: customer?.email || '',
                      phone: customer?.phone || '',
                      country: customer?.country || '',
                      status: customer?.status || 'new',
                      notes: customer?.notes || '',
                    })
                  }}
                >
                  取消
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">公司名称</label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">联系人</label>
                    <Input
                      value={formData.contact_name}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">国家</label>
                    <Input
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">邮箱</label>
                    <Input
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">电话</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">状态</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">备注</label>
                  <Input
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{customer?.company_name}</span>
                </div>
                {customer?.contact_name && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <span>{customer.contact_name}</span>
                  </div>
                )}
                {customer?.country && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <span>{customer.country}</span>
                  </div>
                )}
                {customer?.email && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer?.phone && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">状态：</span>
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {getStatusLabel(customer?.status || 'new')}
                  </span>
                </div>
                {customer?.notes && (
                  <div className="text-sm text-gray-600 mt-2">
                    {customer.notes}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotation Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              报价记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quotations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                暂无报价记录
              </p>
            ) : (
              <div className="space-y-3">
                {quotations.map((q) => (
                  <div
                    key={q.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/quote/history/${q.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{q.quotation_number}</span>
                      <span className="text-sm text-gray-500">
                        {formatDate(q.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {q.trade_term} · {formatPrice(q.total_amount_foreign, q.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              备注
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                placeholder="添加备注..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddRemark()}
              />
              <Button
                onClick={handleAddRemark}
                disabled={addingRemark || !remarkInput.trim()}
              >
                {addingRemark ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
            {remarks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">暂无备注</p>
            ) : (
              <div className="space-y-3">
                {remarks.map((remark) => (
                  <div
                    key={remark.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="text-sm">{remark.content}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {formatDate(remark.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}