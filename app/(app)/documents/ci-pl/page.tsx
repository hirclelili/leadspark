'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Upload,
  ClipboardPaste,
  Pencil,
  Ship,
  Loader2,
  Save,
  FileDown,
  History,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { DocumentKind, QuoteLayoutMode } from '@/components/pdf/QuotationPDF'
import type { ParsedPackingRow } from '@/lib/packingExcelParse'

type SourceTab = 'upload' | 'quotation' | 'manual'

type CiPlLine = {
  id: string
  is_container_header?: boolean
  name: string
  model: string
  specs: string
  qty: number
  unit: string
  unit_price_foreign: number
  amount_foreign: number
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'AUD'] as const

function emptyLine(): CiPlLine {
  return {
    id: crypto.randomUUID(),
    name: '',
    model: '',
    specs: '',
    qty: 1,
    unit: 'pc',
    unit_price_foreign: 0,
    amount_foreign: 0,
  }
}

function headerLine(): CiPlLine {
  return {
    id: crypto.randomUUID(),
    is_container_header: true,
    name: '',
    model: '',
    specs: '',
    qty: 0,
    unit: '',
    unit_price_foreign: 0,
    amount_foreign: 0,
  }
}

function fromParsed(r: ParsedPackingRow): CiPlLine {
  const qty = r.qty > 0 ? r.qty : 1
  const up = r.unit_price_foreign || 0
  return {
    id: crypto.randomUUID(),
    name: r.name,
    model: r.model,
    specs: r.specs,
    qty,
    unit: r.unit || 'pc',
    unit_price_foreign: up,
    amount_foreign: up * qty,
  }
}

function fromQuotationProduct(p: Record<string, unknown>): CiPlLine | null {
  if (p.is_container_header === true) {
    return {
      id: crypto.randomUUID(),
      is_container_header: true,
      name: String(p.name ?? ''),
      model: '',
      specs: '',
      qty: 0,
      unit: '',
      unit_price_foreign: 0,
      amount_foreign: 0,
    }
  }
  const qty = Number(p.qty) || 1
  const up = Number(p.unit_price_foreign) || 0
  const af = Number(p.amount_foreign)
  return {
    id: crypto.randomUUID(),
    name: String(p.name ?? ''),
    model: String(p.model ?? ''),
    specs: String(p.specs ?? ''),
    qty,
    unit: String(p.unit ?? 'pc'),
    unit_price_foreign: up,
    amount_foreign: Number.isFinite(af) ? af : up * qty,
  }
}

const SYM: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  JPY: '¥',
  AUD: 'A$',
}

export default function CiPlPage() {
  const searchParams = useSearchParams()
  const docIdParam = searchParams.get('id')

  const [tab, setTab] = useState<SourceTab>('manual')
  const [lines, setLines] = useState<CiPlLine[]>([emptyLine()])
  const [currency, setCurrency] = useState('USD')
  const [quoteMode, setQuoteMode] = useState<QuoteLayoutMode>('product_list')
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [containerNotes, setContainerNotes] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [title, setTitle] = useState('')
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [userProfile, setUserProfile] = useState<Record<string, unknown> | null>(null)

  const [quoteList, setQuoteList] = useState<{ id: string; quotation_number: string }[]>([])
  const [quotePick, setQuotePick] = useState<string>('')
  const [linkedQuotationId, setLinkedQuotationId] = useState<string | null>(null)
  const [loadingQuotes, setLoadingQuotes] = useState(false)

  const [draftList, setDraftList] = useState<
    {
      id: string
      title: string | null
      currency: string
      updated_at: string
    }[]
  >([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  const sym = SYM[currency] || `${currency} `

  const totalForeign = useMemo(
    () =>
      lines
        .filter((l) => !l.is_container_header)
        .reduce((s, l) => s + l.amount_foreign, 0),
    [lines]
  )

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user-profile')
      const p = await res.json()
      if (!p?.error) setUserProfile(p)
    } catch {
      /* ignore */
    }
  }, [])

  const loadDraftList = useCallback(async () => {
    setLoadingDrafts(true)
    try {
      const res = await fetch('/api/ci-pl/documents')
      const data = await res.json()
      setDraftList(data.documents || [])
    } catch {
      /* ignore */
    } finally {
      setLoadingDrafts(false)
    }
  }, [])

  const loadDocument = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ci-pl/documents/${id}`)
      const d = await res.json()
      if (d.error) {
        toast.error(d.error)
        return
      }
      setDocumentId(d.id)
      setLinkedQuotationId(d.quotation_id || null)
      setTitle(d.title || '')
      setCurrency(d.currency || 'USD')
      setCustomerName(d.customer_name || '')
      setCustomerContact(d.customer_contact || '')
      setCustomerAddress(d.customer_address || '')
      setContainerNotes(d.container_notes || '')
      setReferenceNumber(d.reference_number || '')
      setQuoteMode((d.quote_mode as QuoteLayoutMode) || 'product_list')
      const raw = d.products as Record<string, unknown>[]
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped = raw
          .map((row) => {
            if (row.is_container_header === true) {
              return {
                id: crypto.randomUUID(),
                is_container_header: true as const,
                name: String(row.name ?? ''),
                model: '',
                specs: '',
                qty: 0,
                unit: '',
                unit_price_foreign: 0,
                amount_foreign: 0,
              } satisfies CiPlLine
            }
            const qty = Number(row.qty) || 1
            const up = Number(row.unit_price_foreign) || 0
            const af = Number(row.amount_foreign)
            return {
              id: crypto.randomUUID(),
              name: String(row.name ?? ''),
              model: String(row.model ?? ''),
              specs: String(row.specs ?? ''),
              qty,
              unit: String(row.unit ?? 'pc'),
              unit_price_foreign: up,
              amount_foreign: Number.isFinite(af) ? af : up * qty,
            } satisfies CiPlLine
          })
          .filter(Boolean) as CiPlLine[]
        setLines(mapped.length ? mapped : [emptyLine()])
      } else {
        setLines([emptyLine()])
      }
      toast.success('草稿已加载')
    } catch {
      toast.error('加载草稿失败')
    }
  }, [])

  useEffect(() => {
    loadProfile()
    loadDraftList()
  }, [loadProfile, loadDraftList])

  useEffect(() => {
    if (docIdParam) loadDocument(docIdParam)
  }, [docIdParam, loadDocument])

  const fetchQuotations = async () => {
    setLoadingQuotes(true)
    try {
      const res = await fetch('/api/quotations?limit=40')
      const data = await res.json()
      setQuoteList((data.quotations || []).map((q: { id: string; quotation_number: string }) => ({
        id: q.id,
        quotation_number: q.quotation_number,
      })))
    } catch {
      toast.error('加载报价列表失败')
    } finally {
      setLoadingQuotes(false)
    }
  }

  useEffect(() => {
    if (tab === 'quotation' && quoteList.length === 0) fetchQuotations()
  }, [tab, quoteList.length])

  const applyParsedRows = (rows: ParsedPackingRow[]) => {
    const next = rows.map(fromParsed)
    setLines(next.length ? next : [emptyLine()])
    setTab('manual')
    toast.success(`已载入 ${next.length} 行`)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ci-pl/parse-upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解析失败')
      if (data.warnings?.length) {
        data.warnings.forEach((w: string) => toast.message(w))
      }
      applyParsedRows(data.rows || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleAiParse = async () => {
    if (pasteText.trim().length < 5) {
      toast.error('请粘贴更长一些的表格文本')
      return
    }
    setAiBusy(true)
    try {
      const res = await fetch('/api/ai/parse-packing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pasteText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 解析失败')
      const rows: ParsedPackingRow[] = (data.rows || []).map(
        (r: {
          name: string
          model?: string
          specs?: string
          qty: number
          unit: string
          unit_price_foreign: number
        }) => ({
          name: r.name,
          model: r.model || '',
          specs: r.specs || '',
          qty: r.qty,
          unit: r.unit,
          unit_price_foreign: r.unit_price_foreign,
        })
      )
      applyParsedRows(rows)
      setPasteText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '解析失败')
    } finally {
      setAiBusy(false)
    }
  }

  const importFromQuotation = async () => {
    if (!quotePick) {
      toast.error('请选择一条报价')
      return
    }
    setLoadingQuotes(true)
    try {
      const res = await fetch(`/api/quotations/${quotePick}`)
      const q = await res.json()
      if (q.error) throw new Error(q.error)
      setCurrency(q.currency || 'USD')
      setReferenceNumber(q.reference_number || q.quotation_number || '')
      if (q.customers?.company_name) setCustomerName(q.customers.company_name)
      const products = Array.isArray(q.products) ? q.products : []
      const mapped = products
        .map((p: Record<string, unknown>) => fromQuotationProduct(p))
        .filter(Boolean) as CiPlLine[]
      setLines(mapped.length ? mapped : [emptyLine()])
      setLinkedQuotationId(quotePick)
      setTab('manual')
      toast.success('已从报价导入，请补充单价与货柜信息')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败')
    } finally {
      setLoadingQuotes(false)
    }
  }

  const updateLine = (id: string, patch: Partial<CiPlLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...patch }
        if (!next.is_container_header) {
          const qty = next.qty || 0
          const up = next.unit_price_foreign || 0
          next.amount_foreign = qty * up
        }
        return next
      })
    )
  }

  const productsPayload = () =>
    lines.map((l) => {
      if (l.is_container_header) {
        return {
          is_container_header: true,
          name: l.name,
          qty: 0,
          unit: l.unit || 'pc',
          unit_price_foreign: 0,
          amount_foreign: 0,
        }
      }
      return {
        is_container_header: false,
        name: l.name,
        model: l.model || undefined,
        specs: l.specs || undefined,
        qty: l.qty,
        unit: l.unit || 'pc',
        unit_price_foreign: l.unit_price_foreign,
        amount_foreign: l.amount_foreign,
      }
    })

  const saveDraft = async () => {
    setSaving(true)
    try {
      const body = {
        title: title.trim() || null,
        currency,
        customer_name: customerName,
        customer_contact: customerContact,
        customer_address: customerAddress,
        container_notes: containerNotes,
        quote_mode: quoteMode,
        reference_number: referenceNumber,
        source: tab,
        quotation_id: linkedQuotationId,
        products: productsPayload(),
      }
      const url = documentId ? `/api/ci-pl/documents/${documentId}` : '/api/ci-pl/documents'
      const res = await fetch(url, {
        method: documentId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setDocumentId(data.id)
      toast.success('草稿已保存')
      loadDraftList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const buildPdfProps = (kind: DocumentKind) => {
    const products = lines.map((l) => ({
      name: l.name,
      model: l.model || undefined,
      specs: l.specs || undefined,
      qty: l.is_container_header ? 0 : l.qty,
      unit: l.unit || 'pc',
      unit_price_foreign: l.is_container_header ? 0 : l.unit_price_foreign,
      amount_foreign: l.is_container_header ? 0 : l.amount_foreign,
      is_container_header: l.is_container_header === true,
    }))
    const displayNo = referenceNumber.trim() || 'DRAFT-CI-PL'
    const showSellerHeader =
      kind === 'PL'
        ? userProfile?.seller_visible_pl !== false && userProfile?.seller_visible_pl !== 'false'
        : userProfile?.seller_visible_ci !== false && userProfile?.seller_visible_ci !== 'false'
    return {
      companyName: String(userProfile?.company_name ?? 'Your Company'),
      companyNameCn: userProfile?.company_name_cn as string | undefined,
      address: userProfile?.address as string | undefined,
      phone: userProfile?.phone as string | undefined,
      email: userProfile?.email as string | undefined,
      website: userProfile?.website as string | undefined,
      logoUrl: userProfile?.logo_url as string | undefined,
      bankName: userProfile?.bank_name as string | undefined,
      bankAccount: userProfile?.bank_account as string | undefined,
      bankSwift: userProfile?.bank_swift as string | undefined,
      bankBeneficiary: userProfile?.bank_beneficiary as string | undefined,
      clientName: customerName || '—',
      clientContact: customerContact || undefined,
      clientAddress: customerAddress || undefined,
      quotationNumber: displayNo,
      documentNumberDisplay: displayNo,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      validityDays: 30,
      tradeTerm: 'EXW',
      currency,
      products,
      totalAmount: totalForeign,
      paymentTerms: 'As agreed',
      deliveryTime: 'As agreed',
      packing: containerNotes || undefined,
      remarks: undefined,
      documentKind: kind,
      quoteMode,
      showSellerHeader,
    }
  }

  const downloadBoth = async () => {
    const dataRows = lines.filter((l) => !l.is_container_header)
    if (dataRows.length === 0 || dataRows.some((l) => !l.name.trim())) {
      toast.error('请填写所有产品名称')
      return
    }
    if (quoteMode === 'container_group' && lines.some((l) => l.is_container_header && !l.name.trim())) {
      toast.error('请填写所有货柜/分组标题')
      return
    }
    if (dataRows.some((l) => (l.unit_price_foreign || 0) <= 0)) {
      toast.error('CI 需要有效的单价（外币）')
      return
    }

    setGenerating(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { QuotationPDF } = await import('@/components/pdf/QuotationPDF')

      const ciProps = buildPdfProps('CI')
      const plProps = buildPdfProps('PL')

      const elCi = React.createElement(QuotationPDF, {
        ...(ciProps as React.ComponentProps<typeof QuotationPDF>),
      })
      const elPl = React.createElement(QuotationPDF, {
        ...(plProps as React.ComponentProps<typeof QuotationPDF>),
      })

      const blobCi = await pdf(elCi as Parameters<typeof pdf>[0]).toBlob()
      const blobPl = await pdf(elPl as Parameters<typeof pdf>[0]).toBlob()

      const trigger = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      const base = (referenceNumber.trim() || 'CI-PL').replace(/[/\\?%*:|"<>]/g, '-')
      trigger(blobCi, `${base}-CI.pdf`)
      setTimeout(() => trigger(blobPl, `${base}-PL.pdf`), 400)

      toast.success('已生成 CI 与 PL PDF（如浏览器拦截多文件下载，请允许本站）')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const deleteDraft = async (id: string) => {
    if (!confirm('确定删除此草稿？')) return
    try {
      const res = await fetch(`/api/ci-pl/documents/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (documentId === id) {
        setDocumentId(null)
        setLines([emptyLine()])
      }
      toast.success('已删除')
      loadDraftList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ship className="w-7 h-7 text-blue-600" />
            CI / PL 生成
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            上传工厂装箱单、从报价导入或手动录入 → 补外币单价与货柜信息 → 一键下载 CI（含价）与 PL（不含价）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/quote/history"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            报价历史
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            草稿列表
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {loadingDrafts ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : draftList.length === 0 ? (
            <p className="text-gray-500">暂无保存的草稿</p>
          ) : (
            <ul className="divide-y rounded border max-h-40 overflow-y-auto">
              {draftList.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <Link
                    href={`/documents/ci-pl?id=${d.id}`}
                    className="truncate text-blue-600 hover:underline flex-1"
                  >
                    {d.title || d.id.slice(0, 8)} · {d.currency}
                  </Link>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(d.updated_at).toLocaleString('zh-CN')}
                  </span>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600 p-1"
                    onClick={() => deleteDraft(d.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`rounded-xl border p-4 text-left transition ${
            tab === 'upload' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-6 h-6 text-blue-600 mb-2" />
          <div className="font-medium">上传 Excel</div>
          <p className="text-xs text-gray-500 mt-1">规则解析列：品名、数量、单位、净毛重等</p>
        </button>
        <button
          type="button"
          onClick={() => setTab('quotation')}
          className={`rounded-xl border p-4 text-left transition ${
            tab === 'quotation' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <ClipboardPaste className="w-6 h-6 text-green-600 mb-2" />
          <div className="font-medium">从报价导入</div>
          <p className="text-xs text-gray-500 mt-1">选取历史报价单，沿用产品与分组</p>
        </button>
        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`rounded-xl border p-4 text-left transition ${
            tab === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Pencil className="w-6 h-6 text-amber-600 mb-2" />
          <div className="font-medium">手动录入</div>
          <p className="text-xs text-gray-500 mt-1">在下方表格直接编辑</p>
        </button>
      </div>

      {tab === 'upload' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <label className="cursor-pointer block">
              <span className="text-sm font-medium">选择 .xlsx / .csv</span>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-2"
                onChange={handleFile}
                disabled={uploading}
              />
            </label>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在解析…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'quotation' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full space-y-2">
                <span className="text-sm font-medium block">报价单</span>
                <Select
                  value={quotePick}
                  onValueChange={(v) => setQuotePick(v ?? '')}
                  disabled={loadingQuotes}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingQuotes ? '加载中…' : '选择报价'} />
                  </SelectTrigger>
                  <SelectContent>
                    {quoteList.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.quotation_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={importFromQuotation} disabled={!quotePick}>
                导入到编辑器
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">统一编辑</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-sm font-medium block mb-1">草稿标题（可选）</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="备注名" />
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">单据参考号 / No.</span>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="可与报价参考号一致"
              />
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">币种</span>
              <Select value={currency} onValueChange={(v) => setCurrency(v ?? 'USD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">PDF 行布局</span>
              <Select
                value={quoteMode}
                onValueChange={(v) => v && setQuoteMode(v as QuoteLayoutMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_list">产品列表</SelectItem>
                  <SelectItem value="container_group">按货柜分组</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <span className="text-sm font-medium block mb-1">客户名称</span>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">联系人</span>
              <Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">地址</span>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <span className="text-sm font-medium block mb-1">货柜 / 装箱备注（显于 Packing 栏）</span>
              <Textarea
                value={containerNotes}
                onChange={(e) => setContainerNotes(e.target.value)}
                rows={2}
                placeholder="如：1×40HQ，分批装运等"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">粘贴乱表 · AI 兜底抽取</span>
            </div>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder="从 Excel 复制整块粘贴到此处，若规则解析失败可用 AI 抽取行项目"
              className="bg-white"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAiParse} disabled={aiBusy}>
              {aiBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              AI 解析并覆盖表格
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                + 产品行
              </Button>
              {quoteMode === 'container_group' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, headerLine()])}
                >
                  + 货柜标题
                </Button>
              )}
            </div>
            <div className="text-sm text-gray-600">
              合计：<span className="font-semibold text-blue-700">{sym}{totalForeign.toFixed(2)}</span>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">名称 / 标题</th>
                  <th className="text-left p-2 w-24 hidden sm:table-cell">型号</th>
                  <th className="text-right p-2 w-20">数量</th>
                  <th className="text-left p-2 w-16">单位</th>
                  <th className="text-right p-2 w-24">单价</th>
                  <th className="text-right p-2 w-24">金额</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((row) =>
                  row.is_container_header ? (
                    <tr key={row.id} className="border-t bg-amber-50">
                      <td className="p-1" colSpan={6}>
                        <Input
                          className="font-medium border-amber-200"
                          value={row.name}
                          onChange={(e) => updateLine(row.id, { name: e.target.value })}
                          placeholder="货柜 / 分组标题"
                        />
                      </td>
                      <td className="p-1 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            className="text-red-400"
                            onClick={() => setLines((prev) => prev.filter((x) => x.id !== row.id))}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-t">
                      <td className="p-1">
                        <Input
                          value={row.name}
                          onChange={(e) => updateLine(row.id, { name: e.target.value })}
                          placeholder="品名"
                        />
                      </td>
                      <td className="p-1 hidden sm:table-cell">
                        <Input
                          value={row.model}
                          onChange={(e) => updateLine(row.id, { model: e.target.value })}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          className="text-right"
                          value={row.qty}
                          onChange={(e) =>
                            updateLine(row.id, { qty: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.unit}
                          onChange={(e) => updateLine(row.id, { unit: e.target.value })}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          className="text-right"
                          value={row.unit_price_foreign}
                          onChange={(e) =>
                            updateLine(row.id, {
                              unit_price_foreign: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        {sym}
                        {row.amount_foreign.toFixed(2)}
                      </td>
                      <td className="p-1 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            className="text-red-400"
                            onClick={() => setLines((prev) => prev.filter((x) => x.id !== row.id))}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={saveDraft} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              保存草稿
            </Button>
            <Button type="button" onClick={downloadBoth} disabled={generating}>
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              生成 CI + PL PDF
            </Button>
            {documentId && (
              <span className="text-xs text-gray-500 self-center">当前草稿 ID: {documentId.slice(0, 8)}…</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
