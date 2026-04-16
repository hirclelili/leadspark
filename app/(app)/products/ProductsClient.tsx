'use client'

import { useState, useEffect } from 'react'
import {
  Package, Search, Plus, Loader2, Edit, Trash2,
  ChevronLeft, ChevronRight, Upload
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  model: string | null
  cost_price: number
  unit: string
  specs: string | null
  image_url: string | null
  category: string | null
  created_at: string
}

export function ProductsClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [categories, setCategories] = useState<string[]>([])

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    model: '',
    cost_price: '',
    unit: 'pc',
    specs: '',
    category: '',
  })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
  }, [page, search, category])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search) params.set('search', search)
      if (category && category !== 'all') params.set('category', category)

      const res = await fetch(`/api/products?${params}`)
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : '加载产品列表失败')
      } else if (data.error) {
        toast.error(data.error)
      } else {
        setProducts(data.products || [])
        setTotal(data.total || 0)
        setCategories(data.categories || [])
      }
    } catch (error) {
      toast.error('加载产品列表失败，请重试')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name,
        model: product.model || '',
        cost_price: String(product.cost_price),
        unit: product.unit,
        specs: product.specs || '',
        category: product.category || '',
      })
    } else {
      setEditingProduct(null)
      setFormData({
        name: '',
        model: '',
        cost_price: '',
        unit: 'pc',
        specs: '',
        category: '',
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.cost_price) {
      toast.error('请填写产品名称和成本价')
      return
    }

    setSaving(true)
    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cost_price: parseFloat(formData.cost_price),
        }),
      })

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(editingProduct ? '更新成功' : '添加成功')
        setDialogOpen(false)
        fetchProducts()
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个产品吗？')) return

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('删除成功')
        fetchProducts()
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6" />
          <h1 className="text-2xl font-bold">产品库</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/products/import')}>
            <Upload className="mr-2 h-4 w-4" />
            批量导入
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              添加产品
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? '编辑产品' : '添加产品'}
                </DialogTitle>
                <DialogDescription>
                  {editingProduct
                    ? '修改产品信息'
                    : '填写产品信息，成本价用于报价计算'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">产品名称 *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="产品名称"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">型号</label>
                    <Input
                      value={formData.model}
                      onChange={(e) =>
                        setFormData({ ...formData, model: e.target.value })
                      }
                      placeholder="型号/SKU"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">成本价 (CNY) *</label>
                    <Input
                      type="number"
                      value={formData.cost_price}
                      onChange={(e) =>
                        setFormData({ ...formData, cost_price: e.target.value })
                      }
                      placeholder="工厂出厂价"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">单位</label>
                    <Input
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      placeholder="pc/set/kg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">分类</label>
                    <Input
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      placeholder="产品分类"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">规格参数</label>
                  <Input
                    value={formData.specs}
                    onChange={(e) =>
                      setFormData({ ...formData, specs: e.target.value })
                    }
                    placeholder="规格参数"
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  保存
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="搜索产品名称/型号..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v ?? 'all'); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无产品</p>
              <p className="text-sm">点击"添加产品"或"批量导入"开始</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="py-3 px-4">产品名称</th>
                    <th className="py-3 px-4">型号</th>
                    <th className="py-3 px-4">成本价 (CNY)</th>
                    <th className="py-3 px-4">单位</th>
                    <th className="py-3 px-4">分类</th>
                    <th className="py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">
                        {product.name}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {product.model || '-'}
                      </td>
                      <td className="py-3 px-4">
                        ¥{Number(product.cost_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {product.unit}
                      </td>
                      <td className="py-3 px-4">
                        {product.category && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {product.category}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(product)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
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
            共 {total} 个产品，第 {page}/{totalPages} 页
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