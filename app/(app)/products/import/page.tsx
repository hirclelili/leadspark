'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface PreviewProduct {
  name: string
  model: string
  cost_price: number
  unit: string
  specs: string
  category: string
}

export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [uploading, setUploading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewProduct[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number } | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setErrors([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.error) {
        setErrors([data.error])
        toast.error(data.error)
      } else {
        setPreviewData(data.products || [])
        setTotalCount(data.total || 0)
        setErrors(data.errors || [])
        setStep('preview')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('解析文件失败')
    } finally {
      setUploading(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)

    try {
      const res = await fetch('/api/products/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: previewData }),
      })

      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
      } else {
        setImportResult(data)
        setStep('done')
        toast.success(`成功导入 ${data.inserted} 个产品`)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('导入失败')
    } finally {
      setImporting(false)
    }
  }

  const handleBack = () => {
    setStep('upload')
    setPreviewData([])
    setTotalCount(0)
    setErrors([])
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <FileSpreadsheet className="w-6 h-6" />
        <h1 className="text-2xl font-bold">批量导入产品</h1>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>上传 Excel 文件</CardTitle>
            <CardDescription>
              支持 .xlsx 和 .csv 格式，必须包含"产品名称"和"成本价"列
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-gray-400" />
                  <p className="text-gray-500">正在解析...</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 mb-2">点击上传文件</p>
                  <p className="text-sm text-gray-400">支持 .xlsx 和 .csv</p>
                </>
              )}
            </div>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">解析错误</p>
                    <ul className="text-sm text-red-700 mt-1">
                      {errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium mb-2">Excel 模板格式</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">列名</th>
                    <th className="text-left py-1">必填</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1">产品名称</td>
                    <td className="py-1 text-red-500">是</td>
                  </tr>
                  <tr>
                    <td className="py-1">成本价</td>
                    <td className="py-1 text-red-500">是</td>
                  </tr>
                  <tr>
                    <td className="py-1">型号</td>
                    <td className="py-1 text-gray-400">否</td>
                  </tr>
                  <tr>
                    <td className="py-1">单位</td>
                    <td className="py-1 text-gray-400">否</td>
                  </tr>
                  <tr>
                    <td className="py-1">规格</td>
                    <td className="py-1 text-gray-400">否</td>
                  </tr>
                  <tr>
                    <td className="py-1">分类</td>
                    <td className="py-1 text-gray-400">否</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-500">
              共 {totalCount} 条数据，预览前 100 条
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                上传其他文件
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    确认导入
                  </>
                )}
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">部分数据有问题</p>
                  <ul className="text-sm text-yellow-700 mt-1">
                    {errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {errors.length > 5 && <li>...还有 {errors.length - 5} 个错误</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="py-3 px-4">产品名称</th>
                      <th className="py-3 px-4">型号</th>
                      <th className="py-3 px-4">成本价</th>
                      <th className="py-3 px-4">单位</th>
                      <th className="py-3 px-4">分类</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((product, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-3 px-4 font-medium">{product.name}</td>
                        <td className="py-3 px-4 text-gray-500">{product.model || '-'}</td>
                        <td className="py-3 px-4">¥{product.cost_price}</td>
                        <td className="py-3 px-4 text-gray-500">{product.unit}</td>
                        <td className="py-3 px-4 text-gray-500">{product.category || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Done Step */}
      {step === 'done' && (
        <Card className="max-w-xl">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">导入成功</h2>
            <p className="text-gray-500 mb-6">
              成功导入 {importResult?.inserted || 0} 个产品
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={handleBack}>
                继续导入
              </Button>
              <Button onClick={() => router.push('/products')}>
                查看产品库
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}