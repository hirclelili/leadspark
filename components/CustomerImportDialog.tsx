'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload, X, AlertCircle, CheckCircle2, Loader2,
  FileSpreadsheet, ChevronDown, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

// ─── Field definitions ───────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  required: boolean
  aliases: string[]
}

const FIELDS: FieldDef[] = [
  {
    key: 'company_name',
    label: '公司名称',
    required: true,
    aliases: ['公司名称', '公司名', '企业名称', '客户名称', '客户名', 'company', 'company name', 'companyname'],
  },
  {
    key: 'contact_name',
    label: '联系人',
    required: false,
    aliases: ['联系人', '联系人姓名', '姓名', 'contact', 'contact name', 'contactname', 'name'],
  },
  {
    key: 'email',
    label: '邮箱',
    required: false,
    aliases: ['邮箱', '邮件', '电子邮件', 'email', 'e-mail', 'mail'],
  },
  {
    key: 'phone',
    label: '电话',
    required: false,
    aliases: ['电话', '手机', '手机号', '联系电话', 'phone', 'tel', 'telephone', 'whatsapp', 'mobile'],
  },
  {
    key: 'country',
    label: '国家',
    required: false,
    aliases: ['国家', '国家/地区', 'country', 'region'],
  },
  {
    key: 'address',
    label: '地址',
    required: false,
    aliases: ['地址', '公司地址', '详细地址', 'address', 'addr'],
  },
  {
    key: 'status',
    label: '状态',
    required: false,
    aliases: ['状态', 'status'],
  },
  {
    key: 'notes',
    label: '备注',
    required: false,
    aliases: ['备注', '备注信息', '说明', 'notes', 'note', 'remark', 'remarks'],
  },
]

const IGNORE_VALUE = '__ignore__'

// ─── Auto-detect column → field mapping ──────────────────────────────────────

function autoDetect(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const usedFields = new Set<string>()

  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[\s_\-]/g, '')
    for (const field of FIELDS) {
      if (usedFields.has(field.key)) continue
      if (field.aliases.some((a) => a.toLowerCase().replace(/[\s_\-]/g, '') === normalized)) {
        mapping[header] = field.key
        usedFields.add(field.key)
        break
      }
    }
    if (!mapping[header]) mapping[header] = IGNORE_VALUE
  }
  return mapping
}

// ─── Parse raw rows using mapping ────────────────────────────────────────────

function applyMapping(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, string>,
): Record<string, string>[] {
  return rawRows.map((row) => {
    const result: Record<string, string> = {}
    for (const [header, fieldKey] of Object.entries(mapping)) {
      if (fieldKey === IGNORE_VALUE) continue
      const raw = row[header]
      if (raw != null && String(raw).trim()) {
        result[fieldKey] = String(raw).trim()
      }
    }
    return result
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type Step = 'upload' | 'mapping' | 'preview' | 'result'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export function CustomerImportDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Reset when dialog closes ──────────────────────────────────────────────
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep('upload')
      setFileName('')
      setHeaders([])
      setRawRows([])
      setMapping({})
      setPreviewRows([])
      setResult(null)
    }
    onOpenChange(v)
  }

  // ── File parsing ──────────────────────────────────────────────────────────
  const parseFile = useCallback((file: File) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast.error('请上传 .xlsx / .xls / .csv 格式的文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件大小不能超过 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        })

        if (json.length === 0) {
          toast.error('表格为空，请检查文件内容')
          return
        }
        if (json.length > 500) {
          toast.error('单次最多导入 500 行，请分批上传')
          return
        }

        const hdrs = Object.keys(json[0])
        const autoMapping = autoDetect(hdrs)

        setFileName(file.name)
        setHeaders(hdrs)
        setRawRows(json)
        setMapping(autoMapping)
        setStep('mapping')
      } catch {
        toast.error('文件解析失败，请检查格式是否正确')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    e.target.value = ''
  }

  // ── Proceed to preview ────────────────────────────────────────────────────
  const handleConfirmMapping = () => {
    const mapped = applyMapping(rawRows, mapping)
    // Warn if company_name not mapped
    const hasCompany = Object.values(mapping).includes('company_name')
    if (!hasCompany) {
      toast.error('请至少将一列映射为「公司名称」')
      return
    }
    setPreviewRows(mapped)
    setStep('preview')
  }

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: previewRows }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '导入失败')
        return
      }
      setResult(data)
      setStep('result')
      if (data.imported > 0) onImported()
    } catch {
      toast.error('导入失败，请检查网络后重试')
    } finally {
      setImporting(false)
    }
  }

  const validRows = previewRows.filter((r) => r.company_name)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            批量导入客户
          </DialogTitle>
          <DialogDescription>
            支持 .xlsx / .xls / .csv，单次最多 500 行
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-gray-400 px-1">
          {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = { upload: '上传文件', mapping: '字段映射', preview: '预览确认', result: '导入结果' }
            const active = step === s
            const done = ['upload', 'mapping', 'preview', 'result'].indexOf(step) > i
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ArrowRight className="w-3 h-3" />}
                <span className={`${active ? 'text-blue-600 font-medium' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                  {labels[s]}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-2">

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">拖拽文件到此处，或点击选择文件</p>
              <p className="text-xs text-gray-400 mt-1">支持 Excel（.xlsx / .xls）和 CSV 格式，最大 5MB</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                选择文件
              </Button>
            </div>
          )}

          {/* ── Step 2: Column Mapping ── */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  已识别 <span className="font-medium text-gray-800">{rawRows.length}</span> 行数据，共 <span className="font-medium text-gray-800">{headers.length}</span> 列。
                  请确认字段映射是否正确。
                </p>
                <span className="text-xs text-gray-400">{fileName}</span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2.5 text-xs text-gray-500 font-medium w-[40%]">Excel 列名</th>
                      <th className="text-left px-3 py-2.5 text-xs text-gray-500 font-medium">示例值</th>
                      <th className="text-left px-3 py-2.5 text-xs text-gray-500 font-medium w-[35%]">映射为</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {headers.map((header) => {
                      const example = String(rawRows[0]?.[header] || '').slice(0, 30) || '—'
                      return (
                        <tr key={header} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs text-gray-700">{header}</td>
                          <td className="px-3 py-2 text-xs text-gray-400 truncate max-w-[120px]">{example}</td>
                          <td className="px-3 py-2">
                            <Select
                              value={mapping[header] || IGNORE_VALUE}
                              onValueChange={(v) => setMapping((prev) => ({ ...prev, [header]: v ?? IGNORE_VALUE }))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={IGNORE_VALUE}>
                                  <span className="text-gray-400">忽略此列</span>
                                </SelectItem>
                                {FIELDS.map((f) => (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label}{f.required && ' *'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {!Object.values(mapping).includes('company_name') && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  「公司名称」为必填字段，请将对应列映射到「公司名称」
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                  重新上传
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmMapping}
                  disabled={!Object.values(mapping).includes('company_name')}
                  className="ml-auto"
                >
                  下一步：预览数据
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  有效数据 <span className="font-medium text-green-600">{validRows.length}</span> 条
                  {previewRows.length - validRows.length > 0 && (
                    <span className="text-amber-500 ml-2">（{previewRows.length - validRows.length} 条因缺少公司名称将被跳过）</span>
                  )}
                </p>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[340px]">
                <table className="w-full text-xs min-w-[600px]">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b">
                      <th className="text-left px-2.5 py-2 text-gray-500 font-medium">#</th>
                      {FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => (
                        <th key={f.key} className="text-left px-2.5 py-2 text-gray-500 font-medium whitespace-nowrap">
                          {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.slice(0, 50).map((row, i) => {
                      const missing = !row.company_name
                      return (
                        <tr key={i} className={`${missing ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-2.5 py-1.5 text-gray-400">{i + 1}</td>
                          {FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => (
                            <td key={f.key} className={`px-2.5 py-1.5 max-w-[160px] truncate ${f.key === 'company_name' && missing ? 'text-red-400' : 'text-gray-700'}`}>
                              {row[f.key] || <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {previewRows.length > 50 && (
                  <div className="text-center py-2 text-xs text-gray-400 border-t bg-gray-50">
                    仅显示前 50 条，实际将导入 {validRows.length} 条
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>
                  返回修改映射
                </Button>
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={importing || validRows.length === 0}
                  className="ml-auto bg-green-600 hover:bg-green-700 text-white"
                >
                  {importing
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />导入中...</>
                    : <>确认导入 {validRows.length} 条客户</>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Result ── */}
          {step === 'result' && result && (
            <div className="space-y-4 py-4">
              <div className={`flex items-center gap-3 p-4 rounded-xl ${result.imported > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {result.imported > 0
                  ? <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                  : <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
                }
                <div>
                  <div className="font-medium text-gray-800">
                    成功导入 <span className="text-green-600 text-lg font-bold">{result.imported}</span> 条客户
                  </div>
                  {result.skipped > 0 && (
                    <div className="text-sm text-gray-500">已跳过 {result.skipped} 条（缺少公司名称）</div>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-red-600 mb-1">以下批次导入失败：</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-500">{e}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                  关闭
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setStep('upload'); setFileName(''); setHeaders([]); setRawRows([]); setMapping({}); setPreviewRows([]); setResult(null)
                }}>
                  继续导入
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
