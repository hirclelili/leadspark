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
  Copy,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CURRENCY_OPTIONS, getCurrencySymbol } from '@/lib/currencies'
import type { ParsedPackingRow } from '@/lib/packingExcelParse'

type SourceTab = 'upload' | 'quotation' | 'manual'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CiPlLine = {
  id: string
  is_container_header?: boolean
  // Basic
  name: string
  model: string
  // Customs fields
  hs_code: string
  size: string
  material: string
  country_of_origin: string
  // Quantity
  qty: number
  unit: string
  // Packing
  no_of_packages: number
  cbm: number
  nw: number
  gw: number
  // Pricing (CI mode)
  unit_price_foreign: number
  amount_foreign: number
}

function emptyLine(): CiPlLine {
  return {
    id: crypto.randomUUID(),
    name: '',
    model: '',
    hs_code: '',
    size: '',
    material: '',
    country_of_origin: '',
    qty: 1,
    unit: 'pc',
    no_of_packages: 0,
    cbm: 0,
    nw: 0,
    gw: 0,
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
    hs_code: '',
    size: '',
    material: '',
    country_of_origin: '',
    qty: 0,
    unit: '',
    no_of_packages: 0,
    cbm: 0,
    nw: 0,
    gw: 0,
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
    model: r.model || '',
    hs_code: r.hs_code || '',
    size: r.size || '',
    material: r.material || '',
    country_of_origin: r.country_of_origin || '',
    qty,
    unit: r.unit || 'pc',
    no_of_packages: r.no_of_packages || 0,
    cbm: r.cbm || 0,
    nw: r.nw || 0,
    gw: r.gw || 0,
    unit_price_foreign: up,
    amount_foreign: up * qty,
  }
}

function fromDbProduct(row: Record<string, unknown>): CiPlLine | null {
  if (row.is_container_header === true) {
    return { ...headerLine(), id: crypto.randomUUID(), name: String(row.name ?? '') }
  }
  const qty = Number(row.qty) || 1
  const up = Number(row.unit_price_foreign) || 0
  const af = Number(row.amount_foreign)
  return {
    id: crypto.randomUUID(),
    name: String(row.name ?? ''),
    model: String(row.model ?? ''),
    hs_code: String(row.hs_code ?? ''),
    size: String(row.size ?? ''),
    material: String(row.material ?? ''),
    country_of_origin: String(row.country_of_origin ?? ''),
    qty,
    unit: String(row.unit ?? 'pc'),
    no_of_packages: Number(row.no_of_packages) || 0,
    cbm: Number(row.cbm) || 0,
    nw: Number(row.nw) || 0,
    gw: Number(row.gw) || 0,
    unit_price_foreign: up,
    amount_foreign: Number.isFinite(af) ? af : up * qty,
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CiPlPage() {
  const searchParams = useSearchParams()
  const docIdParam = searchParams.get('id')

  // ── State ──
  const [tab, setTab] = useState<SourceTab>('manual')
  const [lines, setLines] = useState<CiPlLine[]>([emptyLine()])
  const [currency, setCurrency] = useState('USD')
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [title, setTitle] = useState('')
  // Shipment info
  const [portOfLoading, setPortOfLoading] = useState('')
  const [portOfDischarge, setPortOfDischarge] = useState('')
  const [vesselVoyage, setVesselVoyage] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [sealNumber, setSealNumber] = useState('')
  const [tradeTerm, setTradeTerm] = useState('FOB')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [remarks, setRemarks] = useState('')

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
    { id: string; title: string | null; currency: string; updated_at: string }[]
  >([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<'drafts' | 'editor'>('editor')
  const [importHint, setImportHint] = useState<string | null>(null)

  const sym = getCurrencySymbol(currency)

  const totalForeign = useMemo(
    () => lines.filter((l) => !l.is_container_header).reduce((s, l) => s + l.amount_foreign, 0),
    [lines]
  )
  const totalPackages = useMemo(
    () => lines.filter((l) => !l.is_container_header).reduce((s, l) => s + l.no_of_packages, 0),
    [lines]
  )
  const totalCbm = useMemo(
    () => lines.filter((l) => !l.is_container_header).reduce((s, l) => s + l.cbm, 0),
    [lines]
  )
  const totalNw = useMemo(
    () => lines.filter((l) => !l.is_container_header).reduce((s, l) => s + l.nw, 0),
    [lines]
  )
  const totalGw = useMemo(
    () => lines.filter((l) => !l.is_container_header).reduce((s, l) => s + l.gw, 0),
    [lines]
  )

  // ── Data loading ──

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user-profile')
      const p = await res.json()
      if (!p?.error) setUserProfile(p)
    } catch { /* ignore */ }
  }, [])

  const loadDraftList = useCallback(async () => {
    setLoadingDrafts(true)
    try {
      const res = await fetch('/api/ci-pl/documents')
      const data = await res.json()
      setDraftList(data.documents || [])
    } catch { /* ignore */ }
    finally { setLoadingDrafts(false) }
  }, [])

  const loadDocument = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ci-pl/documents/${id}`)
      const d = await res.json()
      if (d.error) { toast.error(d.error); return }
      setDocumentId(d.id)
      setLinkedQuotationId(d.quotation_id || null)
      setTitle(d.title || '')
      setCurrency(d.currency || 'USD')
      setCustomerName(d.customer_name || '')
      setCustomerContact(d.customer_contact || '')
      setCustomerAddress(d.customer_address || '')
      setCustomerPhone(d.customer_phone || '')
      setReferenceNumber(d.reference_number || '')
      setPortOfLoading(d.port_of_loading || '')
      setPortOfDischarge(d.port_of_discharge || '')
      setVesselVoyage(d.vessel_voyage || '')
      setContainerNumber(d.container_number || '')
      setSealNumber(d.seal_number || '')
      setTradeTerm(d.trade_term || 'FOB')
      setPaymentTerms(d.payment_terms || '')
      // Migrate old container_notes to remarks
      setRemarks(d.container_notes || '')
      const raw = d.products as Record<string, unknown>[]
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped = raw.map(fromDbProduct).filter(Boolean) as CiPlLine[]
        setLines(mapped.length ? mapped : [emptyLine()])
      } else {
        setLines([emptyLine()])
      }
      setImportHint(null)
      toast.success('草稿已加载')
    } catch {
      toast.error('加载草稿失败')
    }
  }, [])

  useEffect(() => { loadProfile(); loadDraftList() }, [loadProfile, loadDraftList])
  useEffect(() => { if (docIdParam) loadDocument(docIdParam) }, [docIdParam, loadDocument])
  useEffect(() => { if (docIdParam) setWorkspaceTab('editor') }, [docIdParam])

  const fetchQuotations = async () => {
    setLoadingQuotes(true)
    try {
      const res = await fetch('/api/quotations?limit=40')
      const data = await res.json()
      setQuoteList(
        (data.quotations || []).map((q: { id: string; quotation_number: string }) => ({
          id: q.id,
          quotation_number: q.quotation_number,
        }))
      )
    } catch { toast.error('加载报价列表失败') }
    finally { setLoadingQuotes(false) }
  }
  useEffect(() => {
    if (tab === 'quotation' && quoteList.length === 0) fetchQuotations()
  }, [tab, quoteList.length])

  // ── Handlers ──

  const applyParsedRows = (rows: ParsedPackingRow[]) => {
    const next = rows.map(fromParsed)
    setLines(next.length ? next : [emptyLine()])
    setTab('manual')
    setImportHint(`已从表格解析载入 ${next.length} 行`)
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
      if (data.warnings?.length) data.warnings.forEach((w: string) => toast.message(w))
      applyParsedRows(data.rows || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    } finally { setUploading(false) }
  }

  const handleAiParse = async () => {
    if (pasteText.trim().length < 5) { toast.error('请粘贴更长一些的表格文本'); return }
    setAiBusy(true)
    try {
      const res = await fetch('/api/ai/parse-packing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pasteText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 解析失败')
      applyParsedRows(data.rows || [])
      setPasteText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '解析失败')
    } finally { setAiBusy(false) }
  }

  const importFromQuotation = async () => {
    if (!quotePick) { toast.error('请选择一条报价'); return }
    setLoadingQuotes(true)
    try {
      const res = await fetch(`/api/quotations/${quotePick}`)
      const q = await res.json()
      if (q.error) throw new Error(q.error)
      setCurrency(q.currency || 'USD')
      setReferenceNumber(
        (q.reference_number != null && String(q.reference_number).trim() !== ''
          ? String(q.reference_number) : '') || q.quotation_number || ''
      )
      if (q.customers?.company_name) setCustomerName(String(q.customers.company_name))
      if (q.customers?.contact_name) setCustomerContact(String(q.customers.contact_name))
      if (q.customers?.address) setCustomerAddress(String(q.customers.address))
      if (q.trade_term) setTradeTerm(String(q.trade_term))
      if (q.payment_terms) setPaymentTerms(String(q.payment_terms))
      const products = Array.isArray(q.products) ? q.products : []
      const mapped = products.map((p: Record<string, unknown>) => {
        if (p.is_container_header === true) return { ...headerLine(), id: crypto.randomUUID(), name: String(p.name ?? '') }
        const qty = Number(p.qty) || 1
        const up = Number(p.unit_price_foreign) || 0
        return {
          ...emptyLine(),
          id: crypto.randomUUID(),
          name: String(p.name ?? ''),
          model: String(p.model ?? ''),
          qty,
          unit: String(p.unit ?? 'pc'),
          unit_price_foreign: up,
          amount_foreign: up * qty,
        } satisfies CiPlLine
      }).filter(Boolean) as CiPlLine[]
      setLines(mapped.length ? mapped : [emptyLine()])
      setLinkedQuotationId(quotePick)
      setTab('manual')
      setImportHint(`已从报价 ${q.quotation_number} 带入客户、币种与参考号`)
      toast.success('已从报价导入，请补充 HS Code、重量、CBM 等')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败')
    } finally { setLoadingQuotes(false) }
  }

  const updateLine = (id: string, patch: Partial<CiPlLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...patch }
        if (!next.is_container_header) {
          next.amount_foreign = (next.qty || 0) * (next.unit_price_foreign || 0)
        }
        return next
      })
    )
  }

  const productsPayload = () =>
    lines.map((l) => {
      if (l.is_container_header) return { is_container_header: true, name: l.name }
      return {
        is_container_header: false,
        name: l.name,
        model: l.model || undefined,
        hs_code: l.hs_code || undefined,
        size: l.size || undefined,
        material: l.material || undefined,
        country_of_origin: l.country_of_origin || undefined,
        qty: l.qty,
        unit: l.unit || 'pc',
        no_of_packages: l.no_of_packages || undefined,
        cbm: l.cbm || undefined,
        nw: l.nw || undefined,
        gw: l.gw || undefined,
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
        customer_phone: customerPhone,
        reference_number: referenceNumber,
        port_of_loading: portOfLoading,
        port_of_discharge: portOfDischarge,
        vessel_voyage: vesselVoyage,
        container_number: containerNumber,
        seal_number: sealNumber,
        trade_term: tradeTerm,
        payment_terms: paymentTerms,
        container_notes: remarks, // backward compat
        quote_mode: 'product_list',
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
    } finally { setSaving(false) }
  }

  const validatePdfRows = (requirePricing: boolean): boolean => {
    const dataRows = lines.filter((l) => !l.is_container_header)
    if (dataRows.length === 0 || dataRows.some((l) => !l.name.trim())) {
      toast.error('请填写所有产品名称')
      return false
    }
    if (requirePricing && dataRows.some((l) => (l.unit_price_foreign || 0) <= 0)) {
      toast.error('商业发票（CI）需要有效的单价（外币）')
      return false
    }
    return true
  }

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const buildCiPlProps = (mode: 'CI' | 'PL') => {
    const products = lines.map((l) => ({
      is_container_header: l.is_container_header === true,
      name: l.name,
      model: l.model || undefined,
      hs_code: l.hs_code || undefined,
      size: l.size || undefined,
      material: l.material || undefined,
      country_of_origin: l.country_of_origin || undefined,
      qty: l.is_container_header ? 0 : l.qty,
      unit: l.unit || 'pc',
      no_of_packages: l.no_of_packages || undefined,
      cbm: l.cbm || undefined,
      nw: l.nw || undefined,
      gw: l.gw || undefined,
      unit_price_foreign: l.is_container_header ? 0 : l.unit_price_foreign,
      amount_foreign: l.is_container_header ? 0 : l.amount_foreign,
    }))
    const docNo = referenceNumber.trim() || 'DRAFT'
    return {
      mode,
      companyName: String(userProfile?.company_name ?? 'Your Company'),
      companyNameCn: userProfile?.company_name_cn as string | undefined,
      address: userProfile?.address as string | undefined,
      phone: userProfile?.phone as string | undefined,
      email: userProfile?.email as string | undefined,
      logoUrl: userProfile?.logo_url as string | undefined,
      bankName: userProfile?.bank_name as string | undefined,
      bankAccount: userProfile?.bank_account as string | undefined,
      bankSwift: userProfile?.bank_swift as string | undefined,
      bankBeneficiary: userProfile?.bank_beneficiary as string | undefined,
      bankAddress: userProfile?.bank_address as string | undefined,
      clientName: customerName || '—',
      clientContact: customerContact || undefined,
      clientAddress: customerAddress || undefined,
      clientPhone: customerPhone || undefined,
      documentNumber: docNo,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      currency,
      tradeTerm: tradeTerm || undefined,
      paymentTerms: paymentTerms || undefined,
      portOfLoading: portOfLoading || undefined,
      portOfDischarge: portOfDischarge || undefined,
      vesselVoyage: vesselVoyage || undefined,
      containerNumber: containerNumber || undefined,
      sealNumber: sealNumber || undefined,
      products,
      totalAmount: totalForeign,
      totalPackages: totalPackages || undefined,
      totalCbm: totalCbm || undefined,
      totalNw: totalNw || undefined,
      totalGw: totalGw || undefined,
      remarks: remarks || undefined,
    }
  }

  const downloadPdf = async (mode: 'CI' | 'PL' | 'BOTH') => {
    const requirePricing = mode === 'CI' || mode === 'BOTH'
    if (!validatePdfRows(requirePricing)) return

    setGenerating(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { CiPlPDF } = await import('@/components/pdf/CiPlPDF')
      const base = (referenceNumber.trim() || 'CI-PL').replace(/[/\\?%*:|"<>]/g, '-')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (m: 'CI' | 'PL') => React.createElement(CiPlPDF, buildCiPlProps(m) as Parameters<typeof CiPlPDF>[0]) as unknown as Parameters<typeof pdf>[0]

      if (mode === 'PL') {
        const blob = await pdf(el('PL')).toBlob()
        triggerDownload(blob, `${base}-PL.pdf`)
        toast.success('已生成 Packing List (PL)')
        return
      }
      if (mode === 'CI') {
        const blob = await pdf(el('CI')).toBlob()
        triggerDownload(blob, `${base}-CI.pdf`)
        toast.success('已生成 Commercial Invoice (CI)')
        return
      }
      // BOTH
      const blobCi = await pdf(el('CI')).toBlob()
      const blobPl = await pdf(el('PL')).toBlob()
      triggerDownload(blobCi, `${base}-CI.pdf`)
      setTimeout(() => triggerDownload(blobPl, `${base}-PL.pdf`), 400)
      toast.success('已生成 CI 与 PL')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败')
    } finally { setGenerating(false) }
  }

  const deleteDraft = async (id: string) => {
    if (!confirm('确定删除此草稿？')) return
    try {
      const res = await fetch(`/api/ci-pl/documents/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (documentId === id) { setDocumentId(null); setLines([emptyLine()]) }
      toast.success('已删除')
      loadDraftList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const duplicateDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/ci-pl/documents/${id}`)
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      const body = {
        title: d.title ? `${d.title} (复制)` : null,
        currency: d.currency,
        customer_name: d.customer_name,
        customer_contact: d.customer_contact,
        customer_address: d.customer_address,
        customer_phone: d.customer_phone,
        reference_number: d.reference_number ? `${d.reference_number}-copy` : null,
        port_of_loading: d.port_of_loading,
        port_of_discharge: d.port_of_discharge,
        vessel_voyage: d.vessel_voyage,
        container_number: '',   // 新货柜号需要手动填
        seal_number: '',
        trade_term: d.trade_term,
        payment_terms: d.payment_terms,
        container_notes: d.container_notes,
        quote_mode: 'product_list',
        source: d.source,
        quotation_id: d.quotation_id,
        products: d.products,
      }
      const res2 = await fetch('/api/ci-pl/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data2 = await res2.json()
      if (!res2.ok) throw new Error(data2.error || '复制失败')
      toast.success('已复制，请修改货柜号和产品明细')
      loadDraftList()
      // 自动打开复制后的草稿
      loadDocument(data2.id)
      setWorkspaceTab('editor')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '复制失败')
    }
  }

  // ── Render ──

  const draftListCard = (
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
          <div>
          <ul className="divide-y rounded border max-h-72 overflow-y-auto">
            {draftList.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-1 px-2 py-1.5">
                <Link
                  href={`/documents/ci-pl?id=${d.id}`}
                  className="truncate text-blue-600 hover:underline flex-1 text-xs"
                  onClick={() => setWorkspaceTab('editor')}
                >
                  {d.title || d.id.slice(0, 8)} · {d.currency}
                </Link>
                <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
                  {new Date(d.updated_at).toLocaleString('zh-CN')}
                </span>
                <button
                  type="button"
                  title="复制此草稿（用于同批次下一个货柜）"
                  className="text-gray-400 hover:text-blue-600 p-1 shrink-0"
                  onClick={() => duplicateDraft(d.id)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="text-red-400 hover:text-red-600 p-1 shrink-0"
                  onClick={() => deleteDraft(d.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-1">
            提示：每个草稿对应一个货柜。同批次多货柜时，点 <Copy className="inline w-3 h-3" /> 复制草稿再改货柜号即可。
          </p>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ship className="w-7 h-7 text-blue-600" />
            CI / PL 生成
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            每个草稿 = 一个货柜 = 一套 CI + PL。上传工厂 PL → 填入货柜/港口信息 → 导出 PDF。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/quote" className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50">
            报价计算
          </Link>
          <Link href="/quote/history" className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50">
            报价历史
          </Link>
        </div>
      </div>

      <Tabs value={workspaceTab} onValueChange={(v) => v && setWorkspaceTab(v as 'drafts' | 'editor')}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="drafts">草稿列表</TabsTrigger>
          <TabsTrigger value="editor">编辑与导出</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="mt-4">
          {draftListCard}
        </TabsContent>

        <TabsContent value="editor" className="mt-4 space-y-6">
          {/* Draft status bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-white px-3 py-2.5 text-xs text-slate-600">
            <span>
              草稿状态：
              <span className="font-mono text-slate-800">
                {documentId ? `${documentId.slice(0, 8)}…` : '未保存'}
              </span>
            </span>
            {linkedQuotationId && (
              <span>
                关联报价：
                <span className="font-mono text-slate-800">{linkedQuotationId.slice(0, 8)}…</span>
              </span>
            )}
            {importHint && <span className="text-blue-700 font-medium">{importHint}</span>}
          </div>

          {/* ── Step 1: Data source ── */}
          <div>
            <p className="text-sm font-medium text-slate-800 mb-3">Step 1 · 数据来源</p>
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
                <p className="text-xs text-gray-500 mt-1">解析工厂 PL：品名、HS Code、数量、重量、CBM 等</p>
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
                <p className="text-xs text-gray-500 mt-1">选取历史报价单，沿用产品与单价</p>
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
              <Card className="mt-4">
                <CardContent className="p-6 space-y-4">
                  <label className="cursor-pointer block">
                    <span className="text-sm font-medium">选择 .xlsx / .xls / .csv</span>
                    <Input type="file" accept=".xlsx,.xls,.csv" className="mt-2" onChange={handleFile} disabled={uploading} />
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
              <Card className="mt-4">
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="flex-1 w-full space-y-2">
                      <span className="text-sm font-medium block">报价单</span>
                      <Select value={quotePick} onValueChange={(v) => setQuotePick(v ?? '')} disabled={loadingQuotes}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingQuotes ? '加载中…' : '选择报价'} />
                        </SelectTrigger>
                        <SelectContent>
                          {quoteList.map((q) => (
                            <SelectItem key={q.id} value={q.id}>{q.quotation_number}</SelectItem>
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
          </div>

          {/* ── Step 2: Header info ── */}
          <div>
            <p className="text-sm font-medium text-slate-800 mb-3">Step 2 · 抬头信息</p>
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Row 1: title + ref no + currency */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <span className="text-xs font-medium block mb-1">草稿标题（可选）</span>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="备注名" />
                  </div>
                  <div>
                    <span className="text-xs font-medium block mb-1">发票 / 单据编号</span>
                    <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="CI-20250408-001" />
                  </div>
                  <div>
                    <span className="text-xs font-medium block mb-1">币种</span>
                    <Select value={currency} onValueChange={(v) => setCurrency(v ?? 'USD')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: buyer */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">买方 / TO</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <span className="text-xs font-medium block mb-1">客户名称</span>
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">联系人</span>
                      <Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">电话</span>
                      <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">地址</span>
                      <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Row 3: shipment */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">运输信息</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <span className="text-xs font-medium block mb-1">装货港 (Port of Loading)</span>
                      <Input value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} placeholder="SHANGHAI, CHINA" />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">目的港 (Port of Discharge)</span>
                      <Input value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} placeholder="LOS ANGELES, USA" />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">船名/航次</span>
                      <Input value={vesselVoyage} onChange={(e) => setVesselVoyage(e.target.value)} placeholder="MSC VIVIANA / 2504E" />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">货柜号 (Container No.)</span>
                      <Input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} placeholder="TCNU1234567" />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">铅封号 (Seal No.)</span>
                      <Input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} placeholder="SL1234567" />
                    </div>
                    <div>
                      <span className="text-xs font-medium block mb-1">贸易术语</span>
                      <Input value={tradeTerm} onChange={(e) => setTradeTerm(e.target.value)} placeholder="FOB" />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs font-medium block mb-1">付款条件（CI）</span>
                      <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="T/T 30% deposit, 70% before shipment" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Step 3: Products ── */}
          <div>
            <p className="text-sm font-medium text-slate-800 mb-3">Step 3 · 产品明细</p>
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* AI paste */}
                <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                  <span className="text-sm font-medium">粘贴乱表 · AI 兜底抽取</span>
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={3}
                    placeholder="从 Excel 复制整块粘贴到此处，若规则解析失败可用 AI 抽取行项目"
                    className="bg-white"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAiParse} disabled={aiBusy}>
                    {aiBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    AI 解析并覆盖表格
                  </Button>
                </div>

                {/* Totals bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                      + 添加产品行
                    </Button>
                  </div>
                  <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>金额：<strong className="text-blue-700">{sym}{totalForeign.toFixed(2)}</strong></span>
                    {totalPackages > 0 && <span>箱数：<strong>{totalPackages}</strong></span>}
                    {totalCbm > 0 && <span>CBM：<strong>{totalCbm.toFixed(3)}</strong></span>}
                    {totalNw > 0 && <span>N.W.：<strong>{totalNw.toFixed(2)} kg</strong></span>}
                    {totalGw > 0 && <span>G.W.：<strong>{totalGw.toFixed(2)} kg</strong></span>}
                  </div>
                </div>

                {/* Products table */}
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs min-w-[1100px]">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="text-left p-2 min-w-[130px]">品名 (DESCRIPTION)</th>
                        <th className="text-left p-2 w-[80px]">货号 (ITEM)</th>
                        <th className="text-left p-2 w-[75px]">HS CODE</th>
                        <th className="text-left p-2 w-[80px]">尺寸 (SIZE)</th>
                        <th className="text-left p-2 w-[80px]">材质 (MATERIAL)</th>
                        <th className="text-left p-2 w-[55px]">产地 (C/O)</th>
                        <th className="text-right p-2 w-[55px]">数量 (QTY)</th>
                        <th className="text-left p-2 w-[45px]">单位</th>
                        <th className="text-right p-2 w-[50px]">箱数</th>
                        <th className="text-right p-2 w-[55px]">CBM</th>
                        <th className="text-right p-2 w-[60px]">N.W.(kg)</th>
                        <th className="text-right p-2 w-[60px]">G.W.(kg)</th>
                        <th className="text-right p-2 w-[75px]">单价 ({currency})</th>
                        <th className="text-right p-2 w-[75px]">金额</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.filter((r) => !r.is_container_header).map((row) => (
                        <tr key={row.id} className="border-t hover:bg-gray-50">
                          <td className="p-1">
                            <Input className="text-xs" value={row.name} onChange={(e) => updateLine(row.id, { name: e.target.value })} placeholder="产品描述" />
                          </td>
                          <td className="p-1">
                            <Input className="text-xs" value={row.model} onChange={(e) => updateLine(row.id, { model: e.target.value })} />
                          </td>
                          <td className="p-1">
                            <Input className="text-xs" value={row.hs_code} onChange={(e) => updateLine(row.id, { hs_code: e.target.value })} placeholder="8541.40" />
                          </td>
                          <td className="p-1">
                            <Input className="text-xs" value={row.size} onChange={(e) => updateLine(row.id, { size: e.target.value })} placeholder="60*40*30" />
                          </td>
                          <td className="p-1">
                            <Input className="text-xs" value={row.material} onChange={(e) => updateLine(row.id, { material: e.target.value })} placeholder="ABS+PC" />
                          </td>
                          <td className="p-1">
                            <Input className="text-xs" value={row.country_of_origin} onChange={(e) => updateLine(row.id, { country_of_origin: e.target.value })} placeholder="CHINA" />
                          </td>
                          <td className="p-1">
                            <Input type="number" className="text-right text-xs" value={row.qty} onChange={(e) => updateLine(row.id, { qty: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="p-1">
                            <Input className="text-xs" value={row.unit} onChange={(e) => updateLine(row.id, { unit: e.target.value })} />
                          </td>
                          <td className="p-1">
                            <Input type="number" className="text-right text-xs" value={row.no_of_packages || ''} onChange={(e) => updateLine(row.id, { no_of_packages: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="p-1">
                            <Input type="number" className="text-right text-xs" value={row.cbm || ''} onChange={(e) => updateLine(row.id, { cbm: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="p-1">
                            <Input type="number" className="text-right text-xs" value={row.nw || ''} onChange={(e) => updateLine(row.id, { nw: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="p-1">
                            <Input type="number" className="text-right text-xs" value={row.gw || ''} onChange={(e) => updateLine(row.id, { gw: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="p-1">
                            <Input type="number" className="text-right text-xs" value={row.unit_price_foreign || ''} onChange={(e) => updateLine(row.id, { unit_price_foreign: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="p-2 text-right font-medium text-xs">
                            {row.amount_foreign > 0 ? `${sym}${row.amount_foreign.toFixed(2)}` : ''}
                          </td>
                          <td className="p-1 text-center">
                            {lines.filter((r) => !r.is_container_header).length > 1 && (
                              <button type="button" className="text-red-400" onClick={() => setLines((p) => p.filter((x) => x.id !== row.id))}>×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Remarks */}
                <div>
                  <span className="text-xs font-medium block mb-1">备注 (Remarks)</span>
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="如：1×40HQ，分批装运，签字盖章等"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={saveDraft} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    保存草稿
                  </Button>
                  <Button type="button" variant="outline" onClick={() => downloadPdf('PL')} disabled={generating}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                    仅 PL（装箱单）
                  </Button>
                  <Button type="button" variant="outline" onClick={() => downloadPdf('CI')} disabled={generating}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                    仅 CI（商业发票）
                  </Button>
                  <Button type="button" onClick={() => downloadPdf('BOTH')} disabled={generating}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                    CI + PL
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
