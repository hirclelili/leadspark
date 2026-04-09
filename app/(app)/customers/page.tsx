'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Search, Plus, Loader2, Edit, Trash2,
  ChevronLeft, ChevronRight, MoreVertical
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Customer {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  country: string | null
  address: string | null
  status: string
  notes: string | null
  created_at: string
}

const statusOptions = [
  { value: 'new', label: '新客户', color: 'bg-blue-100 text-blue-800' },
  { value: 'quoted', label: '已报价', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'negotiating', label: '谈判中', color: 'bg-orange-100 text-orange-800' },
  { value: 'won', label: '已成交', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: '已流失', color: 'bg-gray-100 text-gray-800' },
]

export default function CustomersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    country: '',
    address: '',
    status: 'new',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [page, search, status])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search) params.set('search', search)
      if (status) params.set('status', status)

      const res = await fetch(`/api/customers?${params}`)
      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
      } else {
        setCustomers(data.customers || [])
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFormData({
        company_name: customer.company_name,
        contact_name: customer.contact_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        country: customer.country || '',
        address: customer.address || '',
        status: customer.status,
        notes: customer.notes || '',
      })
    } else {
      setEditingCustomer(null)
      setFormData({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        country: '',
        address: '',
        status: 'new',
        notes: '',
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.company_name) {
      toast.error('请填写公司名称')
      return
    }

    setSaving(true)
    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers'
      const method = editingCustomer ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(editingCustomer ? '更新成功' : '添加成功')
        setDialogOpen(false)
        fetchCustomers()
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个客户吗？')) return

    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('删除成功')
        fetchCustomers()
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const getStatusStyle = (s: string) => {
    const opt = statusOptions.find((o) => o.value === s)
    return opt?.color || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (s: string) => {
    const opt = statusOptions.find((o) => o.value === s)
    return opt?.label || s
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" />
          <h1 className="text-2xl font-bold">客户管理</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              添加客户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? '编辑客户' : '添加客户'}
              </DialogTitle>
              <DialogDescription>
                {editingCustomer ? '修改客户信息' : '填写客户信息'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">公司名称 *</label>
                <Input
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                  placeholder="公司名称"
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
                    placeholder="联系人"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">国家</label>
                  <Input
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    placeholder="国家"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">邮箱</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="邮箱"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">电话</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="电话/WhatsApp"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">地址</label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="公司地址"
                />
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
                  placeholder="备注"
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                保存
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="搜索公司/联系人..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部状态</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Customers List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无客户</p>
              <p className="text-sm">点击"添加客户"开始</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="py-3 px-4">公司名称</th>
                    <th className="py-3 px-4">联系人</th>
                    <th className="py-3 px-4">国家</th>
                    <th className="py-3 px-4">状态</th>
                    <th className="py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                      <td className="py-3 px-4 font-medium">
                        {customer.company_name}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {customer.contact_name || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {customer.country || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded ${getStatusStyle(
                            customer.status
                          )}`}
                        >
                          {getStatusLabel(customer.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDialog(customer)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(customer.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {total} 个客户，第 {page}/{totalPages} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}