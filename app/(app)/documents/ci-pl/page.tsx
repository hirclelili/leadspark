'use client'

import React, { useEffect, useState } from 'react'
import {
  Upload,
  Ship,
  Loader2,
  FileDown,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Package,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCY_OPTIONS, getCurrencySymbol } from '@/lib/currencies'
import type { ParsedPackingRow } from '@/lib/packingExcelParse'
import { exportCiPlExcel } from '@/lib/exportCiPlExcel'
import { useUserProfile } from '@/contexts/UserProfileContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type CiPlLine = {
  id: string
  name: string
  model: string
  hs_code: string
  size: string
  material: string
  country_of_origin: string
  qty: number
  unit: string
  no_of_packages: number
  cbm: number
  nw: number
  gw: number
  unit_price_foreign: number
  amount_foreign: number
}

interface SharedInfo {
  customerName: string
  customerContact: string
  customerAddress: string
  customerPhone: string
  portOfLoading: string
  portOfDischarge: string
  tradeTerm: string
  paymentTerms: string
  currency: string
}

interface ContainerData {
  id: string
  containerNumber: string
  sealNumber: string
  vesselVoyage: string
  /** Override shared info for this container only */
  overrideEnabled: boolean
  overrideCustomerName: string
  overridePortOfLoading: string
  overridePortOfDischarge: string
  products: CiPlLine[]
  uploading: boolean
  expanded: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyLine(): CiPlLine {
  return {
    id: crypto.randomUUID(),
    name: '', model: '', hs_code: '', size: '', material: '',
    country_of_origin: '', qty: 1, unit: 'pc',
    no_of_packages: 0, cbm: 0, nw: 0, gw: 0,
    unit_price_foreign: 0, amount_foreign: 0,
  }
}

function newContainer(): ContainerData {
  return {
    id: crypto.randomUUID(),
    containerNumber: '', sealNumber: '', vesselVoyage: '',
    overrideEnabled: false,
    overrideCustomerName: '', overridePortOfLoading: '', overridePortOfDischarge: '',
    products: [emptyLine()],
    uploading: false,
    expanded: true,
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CiPlPage() {
  const [shared, setShared] = useState<SharedInfo>({
    customerName: '', customerContact: '', customerAddress: '',
    customerPhone: '', portOfLoading: '', portOfDischarge: '',
    tradeTerm: 'FOB', paymentTerms: '', currency: 'USD',
  })
  const [containers, setContainers] = useState<ContainerData[]>([newContainer()])
  const { profile: userProfile, refreshProfile } = useUserProfile()
  const [generating, setGenerating] = useState<string | null>(null)
  const [sharedExpanded, setSharedExpanded] = useState(true)

  const sym = getCurrencySymbol(shared.currency)

  // Safety-net: if context profile is still null on mount (e.g. first visit
  // before layout cached the row), trigger a client-side refresh.
  useEffect(() => {
    if (!userProfile) {
      refreshProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Profile comes from global context — no fetch needed here

    // Pre-fill from order detail page (生成 CI/PL)
    try {
      const raw = localStorage.getItem('leadspark_cipl_prefill')
      if (raw) {
        localStorage.removeItem('leadspark_cipl_prefill')
        const prefill = JSON.parse(raw) as {
          customerName?: string
          customerContact?: string
          currency?: string
          tradeTerm?: string
          paymentTerms?: string
          piNumber?: string
          products?: Array<{
            name: string; model?: string; qty: number; unit: string
            unit_price_foreign?: number; amount_foreign?: number
          }>
        }
        setShared(prev => ({
          ...prev,
          customerName: prefill.customerName || prev.customerName,
          customerContact: prefill.customerContact || prev.customerContact,
          currency: prefill.currency || prev.currency,
          tradeTerm: prefill.tradeTerm || prev.tradeTerm,
          paymentTerms: prefill.paymentTerms || prev.paymentTerms,
        }))
        if (prefill.products && prefill.products.length > 0) {
          const lines: CiPlLine[] = prefill.products.map(p => ({
            id: crypto.randomUUID(),
            name: p.name,
            model: p.model || '',
            hs_code: '', size: '', material: '', country_of_origin: '',
            qty: p.qty,
            unit: p.unit || 'pc',
            no_of_packages: 0, cbm: 0, nw: 0, gw: 0,
            unit_price_foreign: p.unit_price_foreign || 0,
            amount_foreign: p.amount_foreign || 0,
          }))
          setContainers([{ ...newContainer(), products: lines }])
        }
        toast.success(`已从 ${prefill.piNumber || 'PI'} 导入数据`)
      }
    } catch { /* ignore */ }
  }, [])

  // ─── Updaters ────────────────────────────────────────────────────────────

  const patchContainer = (id: string, patch: Partial<ContainerData>) =>
    setContainers(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))

  const patchProduct = (cId: string, pId: string, patch: Partial<CiPlLine>) =>
    setContainers(prev => prev.map(c => {
      if (c.id !== cId) return c
      return {
        ...c,
        products: c.products.map(p => {
          if (p.id !== pId) return p
          const next = { ...p, ...patch }
          next.amount_foreign = (next.qty || 0) * (next.unit_price_foreign || 0)
          return next
        }),
      }
    }))

  // ─── File upload ─────────────────────────────────────────────────────────

  const handleFile = async (containerId: string, file: File) => {
    patchContainer(containerId, { uploading: true })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ci-pl/parse-upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解析失败')
      if (data.warnings?.length) data.warnings.forEach((w: string) => toast.message(w))
      const products = (data.rows as ParsedPackingRow[] || []).map(fromParsed)
      patchContainer(containerId, {
        products: products.length ? products : [emptyLine()],
        uploading: false,
        expanded: true,
      })
      toast.success(`已解析 ${products.length} 行`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
      patchContainer(containerId, { uploading: false })
    }
  }

  // ─── PDF generation ───────────────────────────────────────────────────────

  const effectiveInfo = (c: ContainerData) => ({
    customerName: c.overrideEnabled && c.overrideCustomerName ? c.overrideCustomerName : shared.customerName,
    portOfLoading: c.overrideEnabled && c.overridePortOfLoading ? c.overridePortOfLoading : shared.portOfLoading,
    portOfDischarge: c.overrideEnabled && c.overridePortOfDischarge ? c.overridePortOfDischarge : shared.portOfDischarge,
  })

  const buildProps = (c: ContainerData, mode: 'CI' | 'PL') => {
    const eff = effectiveInfo(c)
    const rows = c.products
    const totalAmount = rows.reduce((s, p) => s + p.amount_foreign, 0)
    const totalPackages = rows.reduce((s, p) => s + p.no_of_packages, 0)
    const totalCbm = rows.reduce((s, p) => s + p.cbm, 0)
    const totalNw = rows.reduce((s, p) => s + p.nw, 0)
    const totalGw = rows.reduce((s, p) => s + p.gw, 0)
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
      clientName: eff.customerName || '—',
      clientContact: shared.customerContact || undefined,
      clientAddress: shared.customerAddress || undefined,
      clientPhone: shared.customerPhone || undefined,
      documentNumber: c.containerNumber || 'DRAFT',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      currency: shared.currency,
      tradeTerm: shared.tradeTerm || undefined,
      paymentTerms: shared.paymentTerms || undefined,
      portOfLoading: eff.portOfLoading || undefined,
      portOfDischarge: eff.portOfDischarge || undefined,
      vesselVoyage: c.vesselVoyage || undefined,
      containerNumber: c.containerNumber || undefined,
      sealNumber: c.sealNumber || undefined,
      products: rows.map(p => ({
        name: p.name,
        model: p.model || undefined,
        hs_code: p.hs_code || undefined,
        size: p.size || undefined,
        material: p.material || undefined,
        country_of_origin: p.country_of_origin || undefined,
        qty: p.qty,
        unit: p.unit,
        no_of_packages: p.no_of_packages || undefined,
        cbm: p.cbm || undefined,
        nw: p.nw || undefined,
        gw: p.gw || undefined,
        unit_price_foreign: p.unit_price_foreign,
        amount_foreign: p.amount_foreign,
      })),
      totalAmount,
      totalPackages: totalPackages || undefined,
      totalCbm: totalCbm || undefined,
      totalNw: totalNw || undefined,
      totalGw: totalGw || undefined,
    }
  }

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const downloadOne = async (c: ContainerData, mode: 'CI' | 'PL') => {
    const rows = c.products.filter(p => p.name.trim())
    if (rows.length === 0) { toast.error('请先添加产品行'); return }
    if (mode === 'CI' && rows.some(p => (p.unit_price_foreign || 0) <= 0)) {
      toast.error('CI 需要填写单价'); return
    }
    const key = c.id + mode
    setGenerating(key)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { CiPlPDF } = await import('@/components/pdf/CiPlPDF')
      const props = buildProps(c, mode)
      // react-pdf can only load absolute http/https URLs for images; strip others
      if (props.logoUrl && !/^https?:\/\//i.test(props.logoUrl)) {
        props.logoUrl = undefined
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(React.createElement(CiPlPDF, props as any) as any).toBlob()
      const base = (c.containerNumber || `Container`).replace(/[/\\?%*:|"<>]/g, '-')
      triggerDownload(blob, `${base}-${mode}.pdf`)
      toast.success(`已生成 ${mode} PDF`)
    } catch (err) {
      console.error('PDF generation error:', err)
      toast.error(err instanceof Error ? err.message : '生成失败，请检查控制台')
    } finally { setGenerating(null) }
  }

  const downloadAll = async (mode: 'CI' | 'PL') => {
    const valid = containers.filter(c => c.products.some(p => p.name.trim()))
    if (valid.length === 0) { toast.error('请先添加产品'); return }
    if (mode === 'CI') {
      const missing = valid.some(c => c.products.filter(p => p.name.trim()).some(p => (p.unit_price_foreign || 0) <= 0))
      if (missing) { toast.error('所有货柜都需要填写单价才能批量生成 CI'); return }
    }
    setGenerating('all' + mode)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { CiPlPDF } = await import('@/components/pdf/CiPlPDF')
      for (let i = 0; i < valid.length; i++) {
        const c = valid[i]
        const props = buildProps(c, mode)
        // react-pdf can only load absolute http/https URLs for images; strip others
        if (props.logoUrl && !/^https?:\/\//i.test(props.logoUrl)) {
          props.logoUrl = undefined
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = await pdf(React.createElement(CiPlPDF, props as any) as any).toBlob()
        const base = (c.containerNumber || `Container-${i + 1}`).replace(/[/\\?%*:|"<>]/g, '-')
        setTimeout(() => triggerDownload(blob, `${base}-${mode}.pdf`), i * 500)
      }
      toast.success(`已生成 ${valid.length} 个 ${mode}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败')
      console.error('PDF generation error:', err)
    } finally { setGenerating(null) }
  }

  // ─── Excel export ─────────────────────────────────────────────────────────

  const exportExcel = async (c: ContainerData, mode: 'CI' | 'PL') => {
    const rows = c.products.filter(p => p.name.trim())
    if (rows.length === 0) { toast.error('请先添加产品行'); return }
    const key = c.id + 'XL' + mode
    setGenerating(key)
    try {
      await exportCiPlExcel({
        ...buildProps(c, mode),
        products: rows.map(p => ({
          name: p.name,
          model: p.model || undefined,
          hs_code: p.hs_code || undefined,
          size: p.size || undefined,
          material: p.material || undefined,
          country_of_origin: p.country_of_origin || undefined,
          qty: p.qty,
          unit: p.unit,
          no_of_packages: p.no_of_packages || undefined,
          cbm: p.cbm || undefined,
          nw: p.nw || undefined,
          gw: p.gw || undefined,
          unit_price_foreign: p.unit_price_foreign,
          amount_foreign: p.amount_foreign,
        })),
      })
      toast.success(`已导出 ${mode} Excel`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败')
      console.error('Excel export error:', err)
    } finally { setGenerating(null) }
  }

  // ─── Render container card ────────────────────────────────────────────────

  const renderContainer = (c: ContainerData, idx: number) => {
    const itemCount = c.products.filter(p => p.name.trim()).length
    const total = c.products.reduce((s, p) => s + p.amount_foreign, 0)
    const ciKey    = c.id + 'CI'
    const plKey    = c.id + 'PL'
    const xlCiKey  = c.id + 'XLCI'
    const xlPlKey  = c.id + 'XLPL'

    return (
      <Card key={c.id} className="overflow-hidden border-slate-200">
        {/* ── Card header ── */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-50 border-b">
          <Package className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm font-medium text-slate-600 shrink-0">货柜 {idx + 1}</span>
          <Input
            className="w-40 h-7 text-xs font-mono"
            value={c.containerNumber}
            onChange={e => patchContainer(c.id, { containerNumber: e.target.value })}
            placeholder="货柜号 TCNU…"
          />
          <Input
            className="w-28 h-7 text-xs"
            value={c.sealNumber}
            onChange={e => patchContainer(c.id, { sealNumber: e.target.value })}
            placeholder="铅封号"
          />
          <Input
            className="w-44 h-7 text-xs"
            value={c.vesselVoyage}
            onChange={e => patchContainer(c.id, { vesselVoyage: e.target.value })}
            placeholder="船名/航次（可选）"
          />
          <div className="flex-1 min-w-0" />
          {itemCount > 0 && (
            <span className="text-xs text-slate-400 shrink-0">
              {itemCount} 项{total > 0 ? ` · ${sym}${total.toFixed(2)}` : ''}
            </span>
          )}
          {/* Excel export (primary) */}
          <Button
            size="sm" variant="default"
            className="h-7 px-2.5 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => exportExcel(c, 'CI')}
            disabled={!!generating}
          >
            {generating === xlCiKey ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileSpreadsheet className="w-3 h-3 mr-1" />}
            CI
          </Button>
          <Button
            size="sm" variant="default"
            className="h-7 px-2.5 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => exportExcel(c, 'PL')}
            disabled={!!generating}
          >
            {generating === xlPlKey ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileSpreadsheet className="w-3 h-3 mr-1" />}
            PL
          </Button>
          {/* PDF export (secondary) */}
          <Button
            size="sm" variant="outline"
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={() => downloadOne(c, 'CI')}
            disabled={!!generating}
            title="生成 CI PDF"
          >
            {generating === ciKey ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileDown className="w-3 h-3 mr-1" />}
            CI PDF
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={() => downloadOne(c, 'PL')}
            disabled={!!generating}
            title="生成 PL PDF"
          >
            {generating === plKey ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileDown className="w-3 h-3 mr-1" />}
            PL PDF
          </Button>
          <button
            type="button"
            title="此货柜单独设置（覆盖客户/港口）"
            className={`p-1 rounded hover:bg-slate-200 shrink-0 ${c.overrideEnabled ? 'text-blue-600' : 'text-slate-400'}`}
            onClick={() => patchContainer(c.id, { overrideEnabled: !c.overrideEnabled })}
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-slate-200 shrink-0"
            onClick={() => patchContainer(c.id, { expanded: !c.expanded })}
          >
            {c.expanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {containers.length > 1 && (
            <button
              type="button"
              className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 shrink-0"
              onClick={() => setContainers(prev => prev.filter(x => x.id !== c.id))}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Override fields ── */}
        {c.overrideEnabled && (
          <div className="px-4 py-3 bg-blue-50 border-b">
            <p className="text-xs font-medium text-blue-700 mb-2">此货柜单独设置（留空则使用共用信息）</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">客户名称</span>
                <Input
                  className="h-7 text-xs"
                  value={c.overrideCustomerName}
                  onChange={e => patchContainer(c.id, { overrideCustomerName: e.target.value })}
                  placeholder={`默认：${shared.customerName || '—'}`}
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">装货港</span>
                <Input
                  className="h-7 text-xs"
                  value={c.overridePortOfLoading}
                  onChange={e => patchContainer(c.id, { overridePortOfLoading: e.target.value })}
                  placeholder={`默认：${shared.portOfLoading || '—'}`}
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">目的港</span>
                <Input
                  className="h-7 text-xs"
                  value={c.overridePortOfDischarge}
                  onChange={e => patchContainer(c.id, { overridePortOfDischarge: e.target.value })}
                  placeholder={`默认：${shared.portOfDischarge || '—'}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Product table (collapsible) ── */}
        {c.expanded && (
          <CardContent className="p-4 space-y-3">
            {/* Upload + add row */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="cursor-pointer shrink-0">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-dashed transition-colors ${
                  c.uploading
                    ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700'
                }`}>
                  {c.uploading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 解析中…</>
                    : <><Upload className="w-3.5 h-3.5" /> 上传工厂 PL (.xlsx / .csv)</>}
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={c.uploading}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) await handleFile(c.id, file)
                  }}
                />
              </label>
              <Button
                size="sm" variant="ghost"
                className="text-xs h-7 text-slate-500"
                onClick={() => patchContainer(c.id, { products: [...c.products, emptyLine()] })}
              >
                + 手动添加行
              </Button>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs min-w-[1100px]">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="text-left p-2 min-w-[130px]">品名 (DESCRIPTION)</th>
                    <th className="text-left p-2 w-20">货号</th>
                    <th className="text-left p-2 w-20">HS CODE</th>
                    <th className="text-left p-2 w-20">尺寸</th>
                    <th className="text-left p-2 w-20">材质</th>
                    <th className="text-left p-2 w-14">产地</th>
                    <th className="text-right p-2 w-14">数量</th>
                    <th className="text-left p-2 w-12">单位</th>
                    <th className="text-right p-2 w-12">箱数</th>
                    <th className="text-right p-2 w-14">CBM</th>
                    <th className="text-right p-2 w-16">N.W.(kg)</th>
                    <th className="text-right p-2 w-16">G.W.(kg)</th>
                    <th className="text-right p-2 w-20">单价({shared.currency})</th>
                    <th className="text-right p-2 w-20">金额</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {c.products.map(row => (
                    <tr key={row.id} className="border-t hover:bg-gray-50">
                      <td className="p-1"><Input className="text-xs" value={row.name} onChange={e => patchProduct(c.id, row.id, { name: e.target.value })} placeholder="产品描述" /></td>
                      <td className="p-1"><Input className="text-xs" value={row.model} onChange={e => patchProduct(c.id, row.id, { model: e.target.value })} /></td>
                      <td className="p-1"><Input className="text-xs" value={row.hs_code} onChange={e => patchProduct(c.id, row.id, { hs_code: e.target.value })} placeholder="8541.40" /></td>
                      <td className="p-1"><Input className="text-xs" value={row.size} onChange={e => patchProduct(c.id, row.id, { size: e.target.value })} /></td>
                      <td className="p-1"><Input className="text-xs" value={row.material} onChange={e => patchProduct(c.id, row.id, { material: e.target.value })} /></td>
                      <td className="p-1"><Input className="text-xs" value={row.country_of_origin} onChange={e => patchProduct(c.id, row.id, { country_of_origin: e.target.value })} placeholder="CHINA" /></td>
                      <td className="p-1"><Input type="number" min="0" className="text-right text-xs" value={row.qty} onChange={e => patchProduct(c.id, row.id, { qty: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                      <td className="p-1"><Input className="text-xs" value={row.unit} onChange={e => patchProduct(c.id, row.id, { unit: e.target.value })} /></td>
                      <td className="p-1"><Input type="number" min="0" className="text-right text-xs" value={row.no_of_packages || ''} onChange={e => patchProduct(c.id, row.id, { no_of_packages: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                      <td className="p-1"><Input type="number" min="0" step="0.001" className="text-right text-xs" value={row.cbm || ''} onChange={e => patchProduct(c.id, row.id, { cbm: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                      <td className="p-1"><Input type="number" min="0" step="0.001" className="text-right text-xs" value={row.nw || ''} onChange={e => patchProduct(c.id, row.id, { nw: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                      <td className="p-1"><Input type="number" min="0" step="0.001" className="text-right text-xs" value={row.gw || ''} onChange={e => patchProduct(c.id, row.id, { gw: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                      <td className="p-1"><Input type="number" min="0" step="0.0001" className="text-right text-xs" value={row.unit_price_foreign || ''} onChange={e => patchProduct(c.id, row.id, { unit_price_foreign: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                      <td className="p-2 text-right font-medium">{row.amount_foreign > 0 ? `${sym}${row.amount_foreign.toFixed(2)}` : ''}</td>
                      <td className="p-1 text-center">
                        {c.products.length > 1 && (
                          <button type="button" className="text-red-400 hover:text-red-600" onClick={() => patchContainer(c.id, { products: c.products.filter(p => p.id !== row.id) })}>×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ship className="w-7 h-7 text-blue-600" />
            CI / PL 生成
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            每个货柜对应一套 CI + PL。上传工厂 PL 自动解析，补充价格后导出 Excel（可在 Excel/WPS 中编辑打印），或直接导出 PDF。
          </p>
        </div>
        <div className="shrink-0 text-xs text-right bg-slate-50 border rounded-md px-3 py-2">
          {userProfile?.company_name ? (
            <>
              <div className="font-medium text-slate-700 text-sm">{userProfile.company_name}</div>
              <div className="text-slate-400">公司信息已加载，将自动填入单据抬头</div>
            </>
          ) : (
            <>
              <div className="text-amber-600 font-medium">⚠️ 未检测到公司信息</div>
              <a href="/settings" className="text-blue-500 underline">前往「企业资料」填写公司名称和银行信息</a>
            </>
          )}
        </div>
      </div>

      {/* Shared info (collapsible) */}
      <Card>
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-lg text-left"
          onClick={() => setSharedExpanded(v => !v)}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">共用信息</span>
            {!sharedExpanded && (shared.customerName || shared.portOfDischarge) && (
              <span className="text-xs text-slate-400">
                {[shared.customerName, shared.portOfDischarge, shared.tradeTerm, shared.currency].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          {sharedExpanded
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {sharedExpanded && (
          <CardContent className="px-4 pb-4 pt-0 border-t space-y-3">
            <div className="grid gap-3 sm:grid-cols-3 pt-3">
              <div>
                <span className="text-xs font-medium block mb-1">客户名称</span>
                <Input value={shared.customerName} onChange={e => setShared(s => ({ ...s, customerName: e.target.value }))} />
              </div>
              <div>
                <span className="text-xs font-medium block mb-1">联系人</span>
                <Input value={shared.customerContact} onChange={e => setShared(s => ({ ...s, customerContact: e.target.value }))} />
              </div>
              <div>
                <span className="text-xs font-medium block mb-1">电话</span>
                <Input value={shared.customerPhone} onChange={e => setShared(s => ({ ...s, customerPhone: e.target.value }))} />
              </div>
              <div className="sm:col-span-3">
                <span className="text-xs font-medium block mb-1">地址</span>
                <Input value={shared.customerAddress} onChange={e => setShared(s => ({ ...s, customerAddress: e.target.value }))} />
              </div>
              <div>
                <span className="text-xs font-medium block mb-1">装货港</span>
                <Input value={shared.portOfLoading} onChange={e => setShared(s => ({ ...s, portOfLoading: e.target.value }))} placeholder="SHANGHAI, CHINA" />
              </div>
              <div>
                <span className="text-xs font-medium block mb-1">目的港</span>
                <Input value={shared.portOfDischarge} onChange={e => setShared(s => ({ ...s, portOfDischarge: e.target.value }))} placeholder="LOS ANGELES, USA" />
              </div>
              <div>
                <span className="text-xs font-medium block mb-1">贸易术语</span>
                <Input value={shared.tradeTerm} onChange={e => setShared(s => ({ ...s, tradeTerm: e.target.value }))} placeholder="FOB" />
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs font-medium block mb-1">付款条件</span>
                <Input value={shared.paymentTerms} onChange={e => setShared(s => ({ ...s, paymentTerms: e.target.value }))} placeholder="T/T 30% deposit, 70% before shipment" />
              </div>
              <div>
                <span className="text-xs font-medium block mb-1">币种</span>
                <Select value={shared.currency} onValueChange={v => setShared(s => ({ ...s, currency: v ?? 'USD' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Container cards */}
      <div className="space-y-4">
        {containers.map((c, idx) => renderContainer(c, idx))}
      </div>

      {/* Bottom bar: add + batch download */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          variant="outline"
          className="border-dashed"
          onClick={() => setContainers(prev => [...prev, newContainer()])}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          添加货柜
        </Button>
        <div className="flex-1" />
        {containers.length > 1 && (
          <>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!!generating}
              onClick={async () => {
                setGenerating('allXLPL')
                for (const c of containers) {
                  if (c.products.some(p => p.name.trim())) await exportCiPlExcel({ ...buildProps(c, 'PL'), products: c.products.filter(p => p.name.trim()) })
                }
                setGenerating(null)
                toast.success(`已导出 ${containers.length} 个 PL Excel`)
              }}
            >
              {generating === 'allXLPL' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              批量导出全部 PL Excel ({containers.length})
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!!generating}
              onClick={async () => {
                setGenerating('allXLCI')
                for (const c of containers) {
                  if (c.products.some(p => p.name.trim())) await exportCiPlExcel({ ...buildProps(c, 'CI'), products: c.products.filter(p => p.name.trim()) })
                }
                setGenerating(null)
                toast.success(`已导出 ${containers.length} 个 CI Excel`)
              }}
            >
              {generating === 'allXLCI' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              批量导出全部 CI Excel ({containers.length})
            </Button>
            <Button variant="outline" onClick={() => downloadAll('PL')} disabled={!!generating}>
              {generating === 'allPL'
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <FileDown className="w-4 h-4 mr-2" />}
              批量 PL PDF
            </Button>
            <Button variant="outline" onClick={() => downloadAll('CI')} disabled={!!generating}>
              {generating === 'allCI'
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <FileDown className="w-4 h-4 mr-2" />}
              批量 CI PDF
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
