'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Calculator, ChevronDown, ChevronUp, Loader2, RefreshCw, FileText, Search, ArrowLeft, Plus, X, Package, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { AiSidePanel } from '@/components/AiSidePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { CURRENCY_OPTIONS, getCurrencySymbol } from '@/lib/currencies'
import { exportQuoteExcel } from '@/lib/exportQuoteExcel'
import { useUserProfile } from '@/contexts/UserProfileContext'

const TRADE_TERMS = [
  { code: 'EXW', name: 'EXW', desc: '工厂交货' },
  { code: 'FCA', name: 'FCA', desc: '货交承运人' },
  { code: 'FAS', name: 'FAS', desc: '装船前交货' },
  { code: 'FOB', name: 'FOB', desc: '离岸价' },
  { code: 'CFR', name: 'CFR', desc: '成本加运费' },
  { code: 'CPT', name: 'CPT', desc: '运费付至' },
  { code: 'CIF', name: 'CIF', desc: '成本保险费运费' },
  { code: 'CIP', name: 'CIP', desc: '运费保险费付至' },
  { code: 'DAP', name: 'DAP', desc: '目的地交货' },
  { code: 'DPU', name: 'DPU', desc: '卸货交货' },
  { code: 'DDP', name: 'DDP', desc: '完税后交货' },
]

const currencies = CURRENCY_OPTIONS

const OUTPUT_TRADE_TERM = 'EXW' as const

const PAYMENT_TERMS_OPTIONS = [
  'T/T 30% deposit, 70% before shipment',
  'T/T 100% before shipment',
  'T/T 50% deposit, 50% before shipment',
  'L/C at sight',
  'D/P at sight',
  'PayPal',
  'Western Union',
]

// ── Interfaces ───────────────────────────────────────────────────────────────

interface LibraryProduct {
  id: string
  name: string
  model: string | null
  cost_price: number
  unit?: string
  specs?: string
}

interface QuoteResult {
  term: string
  priceForeign: number
  priceCNY: number
}

type PricingMode = 'margin' | 'order_markup_pct' | 'order_markup_fixed'

// One row in the calculator's product input table
interface CalcProductRow {
  id: string
  name: string
  model: string
  unit: string
  costPrice: string // 工厂价 ¥/单位
  quantity: string
  /** 对客单价 ¥/单位；填写则按此行反推利润率，覆盖整单规则（与工厂价同币便于心算） */
  quoteUnitCny: string
}

/** 旧版「对外单价(外币)」存盘时按当前汇率换算为对客单价(¥) */
function migrateCalcProductRows(
  rows: unknown[],
  exchangeRate: number
): CalcProductRow[] {
  const er = exchangeRate > 0 ? exchangeRate : 0.14
  return rows.map((raw) => {
    const r = raw as CalcProductRow & { quoteUnitForeign?: string }
    let quoteUnitCny = r.quoteUnitCny ?? ''
    if (!String(quoteUnitCny).trim() && r.quoteUnitForeign) {
      const f = parseFloat(r.quoteUnitForeign) || 0
      if (f > 0 && er > 0) quoteUnitCny = String(f / er)
    }
    return {
      id: r.id,
      name: r.name,
      model: r.model,
      unit: r.unit,
      costPrice: r.costPrice,
      quantity: r.quantity,
      quoteUnitCny,
    }
  })
}

interface MultiProductQuoteResult {
  byProduct: { productId: string; results: QuoteResult[] }[]
  orderTotals: QuoteResult[]  // sum across all products per Incoterm
}

type QuoteLayoutMode = 'product_list' | 'container_group'

interface PDFProductRow {
  /** Section title row (e.g. container); excluded from totals and cost alignment by index. */
  isContainerHeader?: boolean
  name: string
  model: string
  specs: string
  qty: number
  unit: string
  unit_price_foreign: number
  amount_foreign: number
}

function emptyProductPdfRow(price = 0): PDFProductRow {
  return {
    name: '',
    model: '',
    specs: '',
    qty: 1,
    unit: 'pc',
    unit_price_foreign: price,
    amount_foreign: price,
  }
}

function emptyContainerHeaderRow(): PDFProductRow {
  return {
    isContainerHeader: true,
    name: '',
    model: '',
    specs: '',
    qty: 0,
    unit: '',
    unit_price_foreign: 0,
    amount_foreign: 0,
  }
}

interface Customer {
  id: string
  company_name: string
  contact_name?: string
  email?: string
  country?: string
  address?: string
  status: string
}

interface UserProfile {
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

// ── Pure calculation functions ────────────────────────────────────────────────

function calculateQuote(
  costPrice: number,
  quantity: number,
  domesticCost: number,
  freight: number,
  destinationCost: number,
  insuranceRate: number,
  profitRate: number,
  exchangeRate: number
): QuoteResult[] {
  const unitCost = costPrice / quantity
  const unitDomestic = domesticCost / quantity
  const unitFreight = freight / quantity
  const unitDestination = destinationCost / quantity
  const profitFactor = 1 + profitRate / 100

  return TRADE_TERMS.map((term) => {
    let priceCNY = 0
    switch (term.code) {
      case 'EXW':
        priceCNY = unitCost * profitFactor
        break
      case 'FCA':
        priceCNY = (unitCost + unitDomestic * 0.3) * profitFactor
        break
      case 'FAS':
        priceCNY = (unitCost + unitDomestic * 0.5) * profitFactor
        break
      case 'FOB':
        priceCNY = (unitCost + unitDomestic) * profitFactor
        break
      case 'CFR':
      case 'CPT':
        priceCNY = (unitCost + unitDomestic + unitFreight) * profitFactor
        break
      case 'CIF':
      case 'CIP':
        priceCNY =
          ((unitCost + unitDomestic + unitFreight) * profitFactor) /
          (1 - (insuranceRate / 100) * 1.1)
        break
      case 'DAP':
        priceCNY =
          (unitCost + unitDomestic + unitFreight + unitDestination * 0.7) * profitFactor
        break
      case 'DPU':
        priceCNY =
          (unitCost + unitDomestic + unitFreight + unitDestination) * profitFactor
        break
      case 'DDP':
        priceCNY =
          (unitCost + unitDomestic + unitFreight + unitDestination * 1.15) * profitFactor
        break
    }
    return { term: term.code, priceForeign: priceCNY * exchangeRate, priceCNY }
  })
}

// Allocates shared costs proportionally by quantity across multiple products
function calculateMultiProductQuote(
  products: { id: string; costPrice: number; quantity: number; profitRate: number }[],
  domesticCost: number,
  freight: number,
  destinationCost: number,
  insuranceRate: number,
  exchangeRate: number
): MultiProductQuoteResult {
  const totalQty = products.reduce((s, p) => s + p.quantity, 0)
  if (totalQty === 0) return { byProduct: [], orderTotals: [] }

  const byProduct = products.map((p) => {
    const share = p.quantity / totalQty
    const results = calculateQuote(
      p.costPrice * p.quantity,
      p.quantity,
      domesticCost * share,
      freight * share,
      destinationCost * share,
      insuranceRate,
      p.profitRate,
      exchangeRate
    )
    return { productId: p.id, results }
  })

  const orderTotals = TRADE_TERMS.map(({ code }) => {
    let totalForeign = 0
    let totalCNY = 0
    for (const { productId, results } of byProduct) {
      const r = results.find((r) => r.term === code)!
      const p = products.find((p) => p.id === productId)!
      totalForeign += r.priceForeign * p.quantity
      totalCNY += r.priceCNY * p.quantity
    }
    return { term: code, priceForeign: totalForeign, priceCNY: totalCNY }
  })

  return { byProduct, orderTotals }
}

/**
 * 主路径：整单规则 → 初版；若某行填对客单价(¥)则该行覆盖利润规则（见 UI 说明）。
 * costPrice = 工厂 ¥/单位（可含整单固定加价分摊）；profitRate = 该行对 EXW 的有效利润率%
 */
function buildCalcProductInputs(
  calcProducts: CalcProductRow[],
  pricingMode: PricingMode,
  profitRateStr: string,
  orderMarkupPercentStr: string,
  orderMarkupFixedStr: string
): { id: string; costPrice: number; quantity: number; profitRate: number }[] | null {
  const raw = calcProducts
    .map((p) => ({
      id: p.id,
      unitCost: parseFloat(p.costPrice) || 0,
      qty: parseFloat(p.quantity) || 0,
      quoteCny: parseFloat(p.quoteUnitCny) || 0,
    }))
    .filter((p) => p.unitCost > 0 && p.qty > 0)

  if (raw.length === 0) return null

  const totalFactory = raw.reduce((s, p) => s + p.unitCost * p.qty, 0)
  const fixedAmt = parseFloat(orderMarkupFixedStr) || 0

  return raw.map((p) => {
    let unitCost = p.unitCost

    if (pricingMode === 'order_markup_fixed' && totalFactory > 0 && fixedAmt > 0) {
      const lineFactory = p.unitCost * p.qty
      const addPerUnit = (lineFactory / totalFactory) * fixedAmt / p.qty
      unitCost = p.unitCost + addPerUnit
    }

    let profitRate =
      pricingMode === 'margin'
        ? parseFloat(profitRateStr) || 10
        : pricingMode === 'order_markup_pct'
          ? parseFloat(orderMarkupPercentStr) || 0
          : parseFloat(profitRateStr) || 0

    if (p.quoteCny > 0) {
      profitRate = (p.quoteCny / unitCost - 1) * 100
    }

    return {
      id: p.id,
      costPrice: unitCost,
      quantity: p.qty,
      profitRate,
    }
  })
}

function calculateDiscount(lclFreight: number, fclFreight: number, lclQty: number): number {
  if (lclFreight <= 0) return 0
  const lclPrice = (lclFreight / lclQty) * 1.1
  const fclPrice = (fclFreight / lclQty) * 1.1
  if (lclPrice <= 0) return 0
  return ((lclPrice - fclPrice) / lclPrice) * 100
}

function getOrderTotalForeign(multi: MultiProductQuoteResult | null, term: string): number {
  return multi?.orderTotals.find((r) => r.term === term)?.priceForeign ?? 0
}

/** EXW 仅来自出厂价计算；其余术语来自含物流费的计算 */
function multiForLineTerm(
  term: string,
  factory: MultiProductQuoteResult | null,
  logistics: MultiProductQuoteResult | null
): MultiProductQuoteResult | null {
  if (term === 'EXW') return factory
  return logistics
}

function repricePdfProductsForTerm(
  pdfProducts: PDFProductRow[],
  calcProducts: CalcProductRow[],
  multi: MultiProductQuoteResult | null,
  term: string
): PDFProductRow[] {
  if (!multi) return pdfProducts
  const validCalc = calcProducts.filter(
    (p) => parseFloat(p.costPrice) > 0 && parseFloat(p.quantity) > 0
  )
  let calcSlot = 0
  return pdfProducts.map((row) => {
    if (row.isContainerHeader) return row
    const c = validCalc[calcSlot++]
    if (!c) return row
    const bp = multi.byProduct.find((b) => b.productId === c.id)
    const tr = bp?.results.find((r) => r.term === term)
    const unitPrice = tr?.priceForeign ?? 0
    const qty = row.qty || parseFloat(c.quantity) || 1
    return { ...row, unit_price_foreign: unitPrice, amount_foreign: unitPrice * qty }
  })
}

function sumPdfProductRowsForeign(rows: PDFProductRow[]): number {
  return rows.filter((p) => !p.isContainerHeader).reduce((s, p) => s + p.amount_foreign, 0)
}

function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuotePage() {
  // ── Library products + exchange rate
  const [libraryProducts, setLibraryProducts] = useState<LibraryProduct[]>([])
  const [exchangeRate, setExchangeRate] = useState(0.14)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateUpdatedAt, setRateUpdatedAt] = useState('')

  // ── Calculator inputs
  const [calcProducts, setCalcProducts] = useState<CalcProductRow[]>([
    { id: crypto.randomUUID(), name: '', model: '', unit: 'pc', costPrice: '', quantity: '100', quoteUnitCny: '' },
  ])
  const [productPickerRowId, setProductPickerRowId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    domesticCost: '0',
    freight: '0',
    destinationCost: '0',
    insuranceRate: '0.3',
    profitRate: '10',
    pricingMode: 'margin' as PricingMode,
    orderMarkupPercent: '8',
    orderMarkupFixed: '0',
    currency: 'USD',
  })
  const [showLCLFCL, setShowLCLFCL] = useState(false)
  const [lclData, setLclData] = useState({ quantity: '500', freight: '800' })
  const [fclData, setFclData] = useState({ quantity: '2000', freight: '1500' })
  const [showDetail, setShowDetail] = useState(false)
  /** 物流报价区块展示的贸易术语（不含 EXW） */
  const [visibleLogisticsTerms, setVisibleLogisticsTerms] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const { code } of TRADE_TERMS) {
      if (code === 'EXW') continue
      init[code] = ['FOB', 'CFR', 'CIF', 'DAP', 'DDP'].includes(code)
    }
    return init
  })
  /** PI 输出：出厂价 EXW / 物流术语价 / 两者 */
  const [piOutputScope, setPiOutputScope] = useState<'exw' | 'logistics' | 'both'>('exw')
  /** 物流价 PI 或双选时产品行所用贸易术语 */
  const [piLogisticsTerm, setPiLogisticsTerm] = useState<string>('FOB')
  /** 合并 PI 时产品明细行单价采用的术语（通常为 EXW 或 FOB） */
  const [piMergedLineTerm, setPiMergedLineTerm] = useState<string>('EXW')
  /** 同时选出厂价+物流时：合并一份 PDF 或两份 */
  const [piDualPdfMode, setPiDualPdfMode] = useState<'merged' | 'two_pdfs'>('merged')

  // ── Quote dialog state
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [quoteStep, setQuoteStep] = useState<1 | 2>(1)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerData, setNewCustomerData] = useState({
    company_name: '', contact_name: '', email: '', phone: '', country: '', address: '',
  })
  const [lastQuote, setLastQuote] = useState<{
    date: string; trade_term: string; currency: string; total_amount_foreign: number
  } | null>(null)
  const [quoteDetails, setQuoteDetails] = useState({
    tradeTerm: OUTPUT_TRADE_TERM,
    documentKind: 'QUOTATION' as 'QUOTATION' | 'PL' | 'PI' | 'CI',
    referenceNumber: '',
    poNumber: '',
    depositPercent: '30',
    sellerVisiblePl: true,
    sellerVisiblePi: true,
    sellerVisibleCi: true,
    paymentTerms: 'T/T 30% deposit, 70% before shipment',
    deliveryTime: '30 days after deposit',
    packing: '',
    remarks: '',
    validityDays: 30,
  })
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [generatingXlsx, setGeneratingXlsx] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [rateIsFallback, setRateIsFallback] = useState(false)
  // legacy alias kept so other references still compile
  const generating = generatingPdf || generatingXlsx
  const { profile: userProfile, refreshProfile } = useUserProfile()
  // local setter no longer needed — context is the source of truth
  const [pdfProducts, setPdfProducts] = useState<PDFProductRow[]>([])
  const [quoteLayoutMode, setQuoteLayoutMode] = useState<QuoteLayoutMode>('product_list')
  /** 上一档「计算器有效行数」，用于 product_list 下正确切分「对齐行 / 手动追加行」，避免减少计算器行数时旧行被误并入 tail。 */
  const pdfProductListCalcLenRef = useRef<number | null>(null)

  // ── AI Side Panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [inquiryText, setInquiryText] = useState('')
  const [inquiryParsing, setInquiryParsing] = useState(false)
  const [inquiryResult, setInquiryResult] = useState<Record<string, unknown> | null>(null)

  // ── Computed values
  /** 出厂价：不含国内/海运/目的港/保险，仅成本+利润 → 与 EXW 一致 */
  const multiResultsFactory = useMemo(() => {
    const valid = buildCalcProductInputs(
      calcProducts,
      formData.pricingMode,
      formData.profitRate,
      formData.orderMarkupPercent,
      formData.orderMarkupFixed
    )
    if (!valid || valid.length === 0) return null

    return calculateMultiProductQuote(valid, 0, 0, 0, 0, exchangeRate)
  }, [
    calcProducts,
    formData.pricingMode,
    formData.profitRate,
    formData.orderMarkupPercent,
    formData.orderMarkupFixed,
    exchangeRate,
  ])

  /** 含物流费用的全量术语报价 */
  const multiResultsLogistics = useMemo(() => {
    const valid = buildCalcProductInputs(
      calcProducts,
      formData.pricingMode,
      formData.profitRate,
      formData.orderMarkupPercent,
      formData.orderMarkupFixed
    )
    if (!valid || valid.length === 0) return null

    return calculateMultiProductQuote(
      valid,
      parseFloat(formData.domesticCost) || 0,
      parseFloat(formData.freight) || 0,
      parseFloat(formData.destinationCost) || 0,
      parseFloat(formData.insuranceRate) || 0.3,
      exchangeRate
    )
  }, [calcProducts, formData, exchangeRate])

  const discount = useMemo(() => {
    if (!showLCLFCL) return 0
    return calculateDiscount(
      parseFloat(lclData.freight) || 0,
      parseFloat(fclData.freight) || 0,
      parseFloat(lclData.quantity) || 500
    )
  }, [showLCLFCL, lclData, fclData])

  const selectedTradeResult = useMemo(
    () => multiResultsFactory?.orderTotals.find((r) => r.term === OUTPUT_TRADE_TERM) || null,
    [multiResultsFactory]
  )

  const factoryCostTotalCNY = useMemo(
    () =>
      calcProducts.reduce(
        (s, p) => s + (parseFloat(p.costPrice) || 0) * (parseFloat(p.quantity) || 0),
        0
      ),
    [calcProducts]
  )

  const calcInputsForDisplay = useMemo(
    () =>
      buildCalcProductInputs(
        calcProducts,
        formData.pricingMode,
        formData.profitRate,
        formData.orderMarkupPercent,
        formData.orderMarkupFixed
      ),
    [
      calcProducts,
      formData.pricingMode,
      formData.profitRate,
      formData.orderMarkupPercent,
      formData.orderMarkupFixed,
    ]
  )

  const marginById = useMemo(() => {
    const m = new Map<string, number>()
    calcInputsForDisplay?.forEach((p) => m.set(p.id, p.profitRate))
    return m
  }, [calcInputsForDisplay])

  // ── Effects

  // Safety-net: if context profile is null on mount, trigger a client refresh
  useEffect(() => {
    if (!userProfile) refreshProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchLibraryProducts()
    fetchExchangeRate()

    // Load draft from "复用此报价" or localStorage auto-save
    const draftJson = localStorage.getItem('leadspark_quote_draft')
    if (draftJson) {
      try {
        const draft = JSON.parse(draftJson)
        if (draft.calcProducts) {
          setCalcProducts(migrateCalcProductRows(draft.calcProducts, exchangeRate))
        }
        if (draft.formData) {
          setFormData((prev) => ({
            ...prev,
            ...draft.formData,
            pricingMode: (draft.formData.pricingMode as PricingMode) || prev.pricingMode,
            orderMarkupPercent: draft.formData.orderMarkupPercent ?? prev.orderMarkupPercent,
            orderMarkupFixed: draft.formData.orderMarkupFixed ?? prev.orderMarkupFixed,
          }))
        }
        if (draft.quoteDetails) setQuoteDetails((prev) => ({ ...prev, ...draft.quoteDetails }))
        if (draft.quoteLayoutMode === 'container_group' || draft.quoteLayoutMode === 'product_list') {
          setQuoteLayoutMode(draft.quoteLayoutMode)
        }
        if (Array.isArray(draft.pdfProducts) && draft.pdfProducts.length > 0) {
          setPdfProducts(
            draft.pdfProducts.map((row: PDFProductRow) => ({
              ...row,
              isContainerHeader: Boolean(row.isContainerHeader),
            }))
          )
        }
        localStorage.removeItem('leadspark_quote_draft')
      } catch { /* ignore */ }
    } else {
      // Restore auto-saved calculator params (but not when loading a draft)
      const savedParams = localStorage.getItem('leadspark_calc_params')
      if (savedParams) {
        try {
          const params = JSON.parse(savedParams) as Record<string, unknown>
          setFormData((prev) => ({
            ...prev,
            ...params,
            pricingMode: (params.pricingMode as PricingMode) || prev.pricingMode,
            orderMarkupPercent:
              typeof params.orderMarkupPercent === 'string'
                ? params.orderMarkupPercent
                : prev.orderMarkupPercent,
            orderMarkupFixed:
              typeof params.orderMarkupFixed === 'string' ? params.orderMarkupFixed : prev.orderMarkupFixed,
          }))
        } catch { /* ignore */ }
      }
      const savedProducts = localStorage.getItem('leadspark_calc_products')
      if (savedProducts) {
        try {
          const parsed = JSON.parse(savedProducts) as unknown[]
          setCalcProducts(migrateCalcProductRows(parsed, exchangeRate))
        } catch { /* ignore */ }
      }
    }
  }, [])

  // Auto-save calculator params to localStorage
  useEffect(() => {
    localStorage.setItem('leadspark_calc_params', JSON.stringify(formData))
  }, [formData])

  useEffect(() => {
    localStorage.setItem('leadspark_calc_products', JSON.stringify(calcProducts))
  }, [calcProducts])

  // Search customers with debounce
  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    const timer = setTimeout(async () => {
      setCustomerLoading(true)
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerQuery)}&limit=8`)
        const data = await res.json()
        setCustomerResults(data.customers || [])
      } catch { /* ignore */ } finally { setCustomerLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerQuery])

  useEffect(() => {
    pdfProductListCalcLenRef.current = null
  }, [quoteLayoutMode])

  // PDF 产品行：与出厂价 EXW 对齐；产品列表模式为「前 N 行 + 手动行」；货柜模式保留标题行顺序并仅同步产品行价格
  useEffect(() => {
    if (!multiResultsFactory) return
    const validCalc = calcProducts.filter((p) => parseFloat(p.costPrice) > 0 && parseFloat(p.quantity) > 0)
    const newCalcLen = validCalc.length
    const prevCalcLen = pdfProductListCalcLenRef.current

    if (quoteLayoutMode === 'product_list') {
      setPdfProducts((prev) => {
        const head = validCalc.map((p, idx) => {
          const bp = multiResultsFactory!.byProduct.find((b) => b.productId === p.id)
          const tr = bp?.results.find((r) => r.term === OUTPUT_TRADE_TERM)
          const unitPrice = tr?.priceForeign ?? 0
          const qty = parseFloat(p.quantity) || 1
          const reusePrevRow =
            prevCalcLen == null ? idx < newCalcLen : idx < prevCalcLen
          const prevRow = reusePrevRow ? prev[idx] : undefined
          return {
            name: prevRow?.name?.trim() ? prevRow.name : (p.name || '产品'),
            model: prevRow?.model ?? p.model,
            specs: prevRow?.specs ?? '',
            qty,
            unit: p.unit || 'pc',
            unit_price_foreign: unitPrice,
            amount_foreign: unitPrice * qty,
          }
        })
        const tailStart = prevCalcLen == null ? newCalcLen : prevCalcLen
        const tail = prev.slice(tailStart).map((row) => ({
          ...row,
          isContainerHeader: false,
          amount_foreign: row.unit_price_foreign * (row.qty || 1),
        }))
        const out = [...head, ...tail]
        return out.length > 0 ? out : [emptyProductPdfRow(0)]
      })
      pdfProductListCalcLenRef.current = newCalcLen
      return
    }

    // container_group
    setPdfProducts((prev) => {
      const oldProducts = prev.filter((r) => !r.isContainerHeader)
      const newProductRows = validCalc.map((p, idx) => {
        const bp = multiResultsFactory!.byProduct.find((b) => b.productId === p.id)
        const tr = bp?.results.find((r) => r.term === OUTPUT_TRADE_TERM)
        const unitPrice = tr?.priceForeign ?? 0
        const qty = parseFloat(p.quantity) || 1
        const prevRow = oldProducts[idx]
        return {
          isContainerHeader: false as const,
          name: prevRow?.name?.trim() ? prevRow.name : (p.name || '产品'),
          model: prevRow?.model ?? p.model,
          specs: prevRow?.specs ?? '',
          qty,
          unit: p.unit || 'pc',
          unit_price_foreign: unitPrice,
          amount_foreign: unitPrice * qty,
        }
      })

      let pi = 0
      const merged: PDFProductRow[] = []
      for (const row of prev) {
        if (row.isContainerHeader) {
          merged.push({ ...row })
          continue
        }
        const np = newProductRows[pi++]
        if (np) merged.push(np)
      }
      while (pi < newProductRows.length) {
        merged.push(newProductRows[pi++])
      }
      return merged.length > 0 ? merged : [emptyContainerHeaderRow(), emptyProductPdfRow(0)]
    })
    pdfProductListCalcLenRef.current = newCalcLen
  }, [multiResultsFactory, calcProducts, quoteLayoutMode])

  // ── Functions
  const fetchLibraryProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100')
      const data = await res.json()
      setLibraryProducts(data.products || [])
    } catch { /* ignore */ }
  }

  const applyExchangeRate = (data: { rate?: number; updatedAt?: string }, currency: string) => {
    if (data.rate && data.rate > 0) {
      setExchangeRate(data.rate)
      setRateUpdatedAt(data.updatedAt || '')
      setRateIsFallback(false)
    } else {
      // Fallback: approximate rates — warn the user so they know to verify
      const FALLBACK: Record<string, number> = {
        USD: 0.138, EUR: 0.150, GBP: 0.176, JPY: 0.00094,
        AUD: 0.091, CAD: 0.101, AED: 0.0376, SGD: 0.103,
        HKD: 0.0176, CNY: 1,
      }
      const fallback = FALLBACK[currency] ?? 0.138
      setExchangeRate(fallback)
      setRateUpdatedAt('')
      setRateIsFallback(true)
      toast.warning(`汇率获取失败，已使用估算值（1 ${currency} ≈ ${(1 / fallback).toFixed(2)} CNY），请核实后调整`)
    }
  }

  const fetchExchangeRate = async () => {
    setRateLoading(true)
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCurrency: formData.currency }),
      })
      const data = await res.json()
      applyExchangeRate(data, formData.currency)
    } catch { applyExchangeRate({}, formData.currency) } finally { setRateLoading(false) }
  }

  const handleCurrencyChange = async (currency: string) => {
    setFormData((prev) => ({ ...prev, currency }))
    setRateLoading(true)
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCurrency: currency }),
      })
      const data = await res.json()
      applyExchangeRate(data, currency)
    } catch { applyExchangeRate({}, currency) } finally { setRateLoading(false) }
  }

  const addCalcProduct = () => {
    setCalcProducts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        model: '',
        unit: 'pc',
        costPrice: '',
        quantity: '100',
        quoteUnitCny: '',
      },
    ])
  }

  const removeCalcProduct = (id: string) => {
    setCalcProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const updateCalcProduct = (id: string, field: keyof CalcProductRow, value: string) => {
    setCalcProducts((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p))
  }

  const handleLibraryProductSelect = (product: LibraryProduct) => {
    if (!productPickerRowId) return
    setCalcProducts((prev) =>
      prev.map((row) =>
        row.id === productPickerRowId
          ? { ...row, name: product.name, model: product.model || '', costPrice: String(product.cost_price), unit: product.unit || 'pc' }
          : row
      )
    )
    setProductPickerRowId(null)
  }

  const formatTime = (isoString: string) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatPrice = (price: number) => {
    if (price < 1) return price.toFixed(4)
    if (price < 10) return price.toFixed(3)
    return price.toFixed(2)
  }

  const openQuoteDialog = async () => {
    const hasCustomer =
      selectedCustomer != null ||
      (isNewCustomer && newCustomerData.company_name.trim() !== '')
    setQuoteStep(hasCustomer ? 2 : 1)
    setCustomerQuery('')
    setCustomerResults([])

    try {
      // Use profile from context (already loaded by server layout)
      if (userProfile) {
        setQuoteDetails((prev) => ({
          ...prev,
          tradeTerm: OUTPUT_TRADE_TERM,
          paymentTerms: userProfile.default_payment_terms || prev.paymentTerms,
          validityDays: userProfile.default_validity || prev.validityDays,
        }))
        if (userProfile.default_currency) {
          await handleCurrencyChange(userProfile.default_currency)
        }
      }
    } catch { /* use defaults */ }

    setQuoteDialogOpen(true)
  }

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsNewCustomer(false)
    setCustomerQuery(customer.company_name)
    setCustomerResults([])
    try {
      const res = await fetch(`/api/customers/${customer.id}`)
      const data = await res.json()
      if (data.quotations?.length > 0) {
        const q = data.quotations[0]
        setLastQuote({ date: q.created_at, trade_term: q.trade_term, currency: q.currency, total_amount_foreign: q.total_amount_foreign })
      } else {
        setLastQuote(null)
      }
    } catch { setLastQuote(null) }
  }

  function resolvePiPdfRows(): {
    rowsPrimary: PDFProductRow[]
    tradeTermForSave: string
    quoteSummaryLines: { label: string; amountForeign: number }[] | undefined
    twoPdfMode: boolean
    rowsExw?: PDFProductRow[]
    rowsLogistics?: PDFProductRow[]
  } {
    const fac = multiResultsFactory!
    const log = multiResultsLogistics

    if (piOutputScope === 'exw') {
      const m = multiForLineTerm('EXW', fac, log)!
      return {
        rowsPrimary: repricePdfProductsForTerm(pdfProducts, calcProducts, m, 'EXW'),
        tradeTermForSave: 'EXW',
        quoteSummaryLines: undefined,
        twoPdfMode: false,
      }
    }
    if (piOutputScope === 'logistics') {
      const m = multiForLineTerm(piLogisticsTerm, fac, log)!
      return {
        rowsPrimary: repricePdfProductsForTerm(pdfProducts, calcProducts, m, piLogisticsTerm),
        tradeTermForSave: piLogisticsTerm,
        quoteSummaryLines: undefined,
        twoPdfMode: false,
      }
    }
    if (piDualPdfMode === 'merged') {
      const m = multiForLineTerm(piMergedLineTerm, fac, log)!
      return {
        rowsPrimary: repricePdfProductsForTerm(pdfProducts, calcProducts, m, piMergedLineTerm),
        tradeTermForSave: piMergedLineTerm,
        quoteSummaryLines: [
          { label: 'EXW', amountForeign: getOrderTotalForeign(fac, 'EXW') },
          { label: `${piLogisticsTerm}`, amountForeign: getOrderTotalForeign(log!, piLogisticsTerm) },
        ],
        twoPdfMode: false,
      }
    }
    const rowsExw = repricePdfProductsForTerm(pdfProducts, calcProducts, fac, 'EXW')
    const rowsLogistics = repricePdfProductsForTerm(pdfProducts, calcProducts, log!, piLogisticsTerm)
    return {
      rowsPrimary: rowsExw,
      tradeTermForSave: 'EXW',
      quoteSummaryLines: undefined,
      twoPdfMode: true,
      rowsExw,
      rowsLogistics,
    }
  }

  const handleGeneratePDF = async (format: 'pdf' | 'xlsx' = 'pdf') => {
    if (!selectedCustomer && !isNewCustomer) { toast.error('请选择或新建客户'); return }
    if (isNewCustomer && !newCustomerData.company_name.trim()) { toast.error('请填写客户公司名称'); return }
    if (!selectedTradeResult || !multiResultsFactory) { toast.error('请先填写成本信息并计算报价'); return }
    if ((piOutputScope === 'logistics' || piOutputScope === 'both') && !multiResultsLogistics) {
      toast.error('物流报价未就绪，请检查成本与数量')
      return
    }
    const pdfDataRows = pdfProducts.filter((p) => !p.isContainerHeader)
    if (pdfDataRows.length === 0 || pdfDataRows.some((p) => !p.name.trim())) {
      toast.error('请填写所有产品名称')
      return
    }
    if (quoteLayoutMode === 'container_group' && pdfProducts.some((p) => p.isContainerHeader && !p.name.trim())) {
      toast.error('请填写所有货柜/分组标题')
      return
    }

    if (format === 'xlsx') setGeneratingXlsx(true)
    else setGeneratingPdf(true)
    try {
      // Profile comes from global context (populated by server on every navigation)
      const liveProfile = userProfile

      let customerId = selectedCustomer?.id
      let customerName = selectedCustomer?.company_name || ''
      let customerContact = selectedCustomer?.contact_name || ''
      let customerAddress = selectedCustomer?.address || ''

      if (isNewCustomer) {
        const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCustomerData) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '创建客户失败')
        customerId = data.id
        customerName = data.company_name
        customerContact = data.contact_name || ''
        customerAddress = data.address || ''
      }

      const fac = multiResultsFactory
      const log = multiResultsLogistics
      const {
        rowsPrimary,
        tradeTermForSave,
        quoteSummaryLines,
        twoPdfMode,
        rowsExw,
        rowsLogistics,
      } = resolvePiPdfRows()

      const totalForeign = sumPdfProductRowsForeign(rowsPrimary)
      const totalCNY = totalForeign / exchangeRate

      const validCalc = calcProducts.filter((p) => parseFloat(p.costPrice) > 0)
      let calcSlot = 0
      const productsForDB = rowsPrimary.map((p) => {
        if (p.isContainerHeader) {
          return {
            is_container_header: true,
            name: p.name,
            model: p.model || undefined,
            specs: p.specs || undefined,
            qty: 0,
            unit: p.unit || 'pc',
            cost_price: 0,
            unit_price_foreign: 0,
            amount_foreign: 0,
          }
        }
        const c = validCalc[calcSlot++]
        return {
          is_container_header: false,
          name: p.name,
          model: p.model || undefined,
          specs: p.specs || undefined,
          qty: p.qty,
          unit: p.unit,
          cost_price: parseFloat(c?.costPrice || '0'),
          unit_price_foreign: p.unit_price_foreign,
          amount_foreign: p.amount_foreign,
        }
      })

      const quote_snapshot = {
        pi_output_scope: piOutputScope,
        pi_dual_pdf_mode: piOutputScope === 'both' ? piDualPdfMode : undefined,
        pi_logistics_term: piOutputScope !== 'exw' ? piLogisticsTerm : undefined,
        exw_total_foreign: getOrderTotalForeign(fac, 'EXW'),
        logistics_total_foreign:
          log && piOutputScope !== 'exw' ? getOrderTotalForeign(log, piLogisticsTerm) : undefined,
        merged_line_term: piOutputScope === 'both' && piDualPdfMode === 'merged' ? piMergedLineTerm : undefined,
        two_pdf_logistics_total_foreign:
          twoPdfMode && rowsLogistics ? sumPdfProductRowsForeign(rowsLogistics) : undefined,
      }

      const saveRes = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          trade_term: tradeTermForSave,
          currency: formData.currency,
          exchange_rate: exchangeRate,
          products: productsForDB,
          costs: {
            domestic_cost: parseFloat(formData.domesticCost) || 0,
            freight: parseFloat(formData.freight) || 0,
            destination_cost: parseFloat(formData.destinationCost) || 0,
            insurance_rate: parseFloat(formData.insuranceRate) || 0.3,
            profit_rate: parseFloat(formData.profitRate) || 10,
            pricing_mode: formData.pricingMode,
            order_markup_percent: parseFloat(formData.orderMarkupPercent) || 0,
            order_markup_fixed: parseFloat(formData.orderMarkupFixed) || 0,
          },
          total_amount_foreign: totalForeign,
          total_amount_cny: totalCNY,
          payment_terms: quoteDetails.paymentTerms,
          delivery_time: quoteDetails.deliveryTime,
          validity_days: quoteDetails.validityDays,
          packing: quoteDetails.packing,
          remarks: quoteDetails.remarks,
          document_kind: quoteDetails.documentKind,
          reference_number: quoteDetails.referenceNumber.trim() || null,
          seller_visible_pl: quoteDetails.sellerVisiblePl,
          seller_visible_pi: quoteDetails.sellerVisiblePi,
          seller_visible_ci: quoteDetails.sellerVisibleCi,
          po_number: quoteDetails.poNumber.trim() || null,
          deposit_percent:
            quoteDetails.documentKind === 'PI'
              ? parseFloat(quoteDetails.depositPercent) || 0
              : null,
          quote_mode: quoteLayoutMode,
          quote_snapshot,
        }),
      })

      const savedQuote = await saveRes.json()
      if (!saveRes.ok) throw new Error(savedQuote.error || '保存报价失败')

      if (selectedCustomer) {
        await fetch(`/api/customers/${customerId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...selectedCustomer, status: 'quoted' }),
        })
      }

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const docKind = quoteDetails.documentKind
      const showSellerHeader =
        docKind === 'PL'
          ? quoteDetails.sellerVisiblePl
          : docKind === 'PI' || docKind === 'QUOTATION'
            ? quoteDetails.sellerVisiblePi
            : quoteDetails.sellerVisibleCi
      const displayNo = quoteDetails.referenceNumber.trim() || savedQuote.quotation_number
      const depPct = docKind === 'PI' ? parseFloat(quoteDetails.depositPercent) || 0 : 0

      const sharedProps = {
        companyName: liveProfile?.company_name || 'Your Company',
        companyNameCn: liveProfile?.company_name_cn as string | undefined,
        address: liveProfile?.address as string | undefined,
        phone: liveProfile?.phone as string | undefined,
        email: liveProfile?.email as string | undefined,
        website: liveProfile?.website as string | undefined,
        bankName: liveProfile?.bank_name as string | undefined,
        bankAccount: liveProfile?.bank_account as string | undefined,
        bankSwift: liveProfile?.bank_swift as string | undefined,
        bankBeneficiary: liveProfile?.bank_beneficiary as string | undefined,
        clientName: customerName,
        clientContact: customerContact || undefined,
        clientAddress: customerAddress || undefined,
        documentNumber: displayNo,
        date: today,
        validityDays: quoteDetails.validityDays,
        currency: formData.currency,
        paymentTerms: quoteDetails.paymentTerms,
        deliveryTime: quoteDetails.deliveryTime,
        packing: quoteDetails.packing || undefined,
        remarks: quoteDetails.remarks || undefined,
        poNumber: quoteDetails.poNumber.trim() || undefined,
        depositPercent: depPct,
      }

      const mapRows = (rows: PDFProductRow[]) =>
        rows.map((p) => ({
          name: p.name,
          model: p.model || undefined,
          specs: p.specs || undefined,
          qty: p.qty,
          unit: p.unit,
          unit_price_foreign: p.unit_price_foreign,
          amount_foreign: p.amount_foreign,
          is_container_header: p.isContainerHeader === true,
        }))

      if (format === 'xlsx') {
        // ── Excel export ───────────────────────────────────────────────────
        const xlKind = (docKind === 'PI' ? 'PI' : 'QUOTATION') as 'PI' | 'QUOTATION'
        if (twoPdfMode && rowsExw && rowsLogistics) {
          await exportQuoteExcel({ ...sharedProps, documentKind: xlKind, tradeTerm: 'EXW', products: mapRows(rowsExw), totalAmount: sumPdfProductRowsForeign(rowsExw), quoteSummaryLines: undefined })
          await exportQuoteExcel({ ...sharedProps, documentKind: xlKind, documentNumber: `${displayNo}-${piLogisticsTerm}`, tradeTerm: piLogisticsTerm, products: mapRows(rowsLogistics), totalAmount: sumPdfProductRowsForeign(rowsLogistics), quoteSummaryLines: undefined })
        } else {
          await exportQuoteExcel({ ...sharedProps, documentKind: xlKind, tradeTerm: tradeTermForSave, products: mapRows(rowsPrimary), totalAmount: totalForeign, quoteSummaryLines })
        }
      } else {
        // ── PDF export ─────────────────────────────────────────────────────
        const { pdf } = await import('@react-pdf/renderer')
        const { QuotationPDF } = await import('@/components/pdf/QuotationPDF')
        const safeLogoUrl = liveProfile?.logo_url && /^https?:\/\//i.test(liveProfile.logo_url as string) ? liveProfile.logo_url as string : undefined
        const basePdfProps = {
          ...sharedProps,
          logoUrl: safeLogoUrl,
          quotationNumber: savedQuote.quotation_number,
          documentNumberDisplay: displayNo,
          quoteMode: quoteLayoutMode,
          documentKind: docKind,
          showSellerHeader,
          tradeTerm: tradeTermForSave,
        }
        try {
          if (twoPdfMode && rowsExw && rowsLogistics) {
            const totalA = sumPdfProductRowsForeign(rowsExw)
            const totalB = sumPdfProductRowsForeign(rowsLogistics)
            const elA = React.createElement(QuotationPDF, { ...basePdfProps, tradeTerm: 'EXW', products: mapRows(rowsExw), totalAmount: totalA, quoteSummaryLines: undefined })
            const elB = React.createElement(QuotationPDF, { ...basePdfProps, tradeTerm: piLogisticsTerm, products: mapRows(rowsLogistics), totalAmount: totalB, quoteSummaryLines: undefined })
            const blobA = await pdf(elA as Parameters<typeof pdf>[0]).toBlob()
            const blobB = await pdf(elB as Parameters<typeof pdf>[0]).toBlob()
            downloadPdfBlob(blobA, `${savedQuote.quotation_number}-EXW.pdf`)
            setTimeout(() => downloadPdfBlob(blobB, `${savedQuote.quotation_number}-${piLogisticsTerm}.pdf`), 400)
          } else {
            const element = React.createElement(QuotationPDF, { ...basePdfProps, products: mapRows(rowsPrimary), totalAmount: totalForeign, quoteSummaryLines })
            const blob = await pdf(element as Parameters<typeof pdf>[0]).toBlob()
            downloadPdfBlob(blob, `${savedQuote.quotation_number}.pdf`)
          }
        } catch (pdfErr: unknown) {
          console.error('PDF generation error:', pdfErr)
          throw new Error(`PDF 生成失败：${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`)
        }
      }

      toast.success(`报价单 ${savedQuote.quotation_number} 已生成并保存`)
      setQuoteDialogOpen(false)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '生成失败，请重试')
    } finally {
      setGeneratingPdf(false)
      setGeneratingXlsx(false)
    }
  }

  const handlePreviewPDF = async () => {
    if (!selectedCustomer && !isNewCustomer) { toast.error('请先选择客户'); return }
    if (!selectedTradeResult || !multiResultsFactory) { toast.error('请先填写成本信息并计算报价'); return }
    if ((piOutputScope === 'logistics' || piOutputScope === 'both') && !multiResultsLogistics) {
      toast.error('物流报价未就绪')
      return
    }
    const pdfDataRowsPv = pdfProducts.filter((p) => !p.isContainerHeader)
    if (pdfDataRowsPv.length === 0 || pdfDataRowsPv.some((p) => !p.name.trim())) {
      toast.error('请填写所有产品名称')
      return
    }
    if (quoteLayoutMode === 'container_group' && pdfProducts.some((p) => p.isContainerHeader && !p.name.trim())) {
      toast.error('请填写所有货柜/分组标题')
      return
    }

    setPreviewing(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { QuotationPDF } = await import('@/components/pdf/QuotationPDF')

      const customerName = selectedCustomer?.company_name || newCustomerData.company_name
      const customerContact = selectedCustomer?.contact_name || newCustomerData.contact_name || ''
      const customerAddress = selectedCustomer?.address || newCustomerData.address || ''
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

      const {
        rowsPrimary,
        tradeTermForSave,
        quoteSummaryLines,
        twoPdfMode,
        rowsExw,
        rowsLogistics,
      } = resolvePiPdfRows()

      const mapRows = (rows: PDFProductRow[]) =>
        rows.map((p) => ({
          name: p.name,
          model: p.model || undefined,
          specs: p.specs || undefined,
          qty: p.qty,
          unit: p.unit,
          unit_price_foreign: p.unit_price_foreign,
          amount_foreign: p.amount_foreign,
          is_container_header: p.isContainerHeader === true,
        }))

      const basePreviewProps = {
        companyName: userProfile?.company_name || 'Your Company',
        companyNameCn: userProfile?.company_name_cn,
        address: userProfile?.address,
        phone: userProfile?.phone,
        email: userProfile?.email,
        website: userProfile?.website,
        logoUrl: userProfile?.logo_url && /^https?:\/\//i.test(userProfile.logo_url) ? userProfile.logo_url : undefined,
        bankName: userProfile?.bank_name,
        bankAccount: userProfile?.bank_account,
        bankSwift: userProfile?.bank_swift,
        bankBeneficiary: userProfile?.bank_beneficiary,
        clientName: customerName,
        clientContact: customerContact || undefined,
        clientAddress: customerAddress || undefined,
        quotationNumber: 'PREVIEW',
        documentNumberDisplay: quoteDetails.referenceNumber.trim() || 'PREVIEW',
        date: today,
        validityDays: quoteDetails.validityDays,
        currency: formData.currency,
        quoteMode: quoteLayoutMode,
        paymentTerms: quoteDetails.paymentTerms,
        deliveryTime: quoteDetails.deliveryTime,
        packing: quoteDetails.packing || undefined,
        remarks: quoteDetails.remarks || undefined,
        documentKind: quoteDetails.documentKind,
        showSellerHeader:
          quoteDetails.documentKind === 'PL'
            ? quoteDetails.sellerVisiblePl
            : quoteDetails.documentKind === 'PI' ||
                quoteDetails.documentKind === 'QUOTATION'
              ? quoteDetails.sellerVisiblePi
              : quoteDetails.sellerVisibleCi,
        poNumber: quoteDetails.poNumber.trim() || undefined,
        depositPercent:
          quoteDetails.documentKind === 'PI'
            ? parseFloat(quoteDetails.depositPercent) || 0
            : 0,
      }

      if (twoPdfMode && rowsExw && rowsLogistics) {
        const totalA = sumPdfProductRowsForeign(rowsExw)
        const totalB = sumPdfProductRowsForeign(rowsLogistics)
        const elA = React.createElement(QuotationPDF, {
          ...basePreviewProps,
          tradeTerm: 'EXW',
          products: mapRows(rowsExw),
          totalAmount: totalA,
          quoteSummaryLines: undefined,
        })
        const elB = React.createElement(QuotationPDF, {
          ...basePreviewProps,
          tradeTerm: piLogisticsTerm,
          products: mapRows(rowsLogistics),
          totalAmount: totalB,
          quoteSummaryLines: undefined,
        })
        const blobA = await pdf(elA as Parameters<typeof pdf>[0]).toBlob()
        const blobB = await pdf(elB as Parameters<typeof pdf>[0]).toBlob()
        const urlA = URL.createObjectURL(blobA)
        window.open(urlA, '_blank')
        setTimeout(() => {
          const urlB = URL.createObjectURL(blobB)
          window.open(urlB, '_blank')
          setTimeout(() => {
            URL.revokeObjectURL(urlA)
            URL.revokeObjectURL(urlB)
          }, 8000)
        }, 300)
      } else {
        const totalForeign = sumPdfProductRowsForeign(rowsPrimary)
        const element = React.createElement(QuotationPDF, {
          ...basePreviewProps,
          tradeTerm: tradeTermForSave,
          products: mapRows(rowsPrimary),
          totalAmount: totalForeign,
          quoteSummaryLines,
        })
        const blob = await pdf(element as Parameters<typeof pdf>[0]).toBlob()
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '预览失败，请重试')
    } finally {
      setPreviewing(false)
    }
  }

  const handleParseInquiry = async () => {
    if (!inquiryText.trim()) { toast.error('请粘贴询盘邮件内容'); return }
    setInquiryParsing(true)
    setInquiryResult(null)
    try {
      const res = await fetch('/api/ai/parse-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText: inquiryText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解析失败')
      setInquiryResult(data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '解析失败，请重试')
    } finally {
      setInquiryParsing(false)
    }
  }

  const handleFillFromInquiry = () => {
    if (!inquiryResult) return
    const r = inquiryResult
    setCalcProducts((prev) => {
      const updated = [...prev]
      if (updated.length > 0) {
        updated[0] = {
          ...updated[0],
          name: (r.product_name as string) || updated[0].name,
          quantity: r.quantity != null ? String(r.quantity) : updated[0].quantity,
          unit: (r.unit as string) || updated[0].unit,
        }
      }
      return updated
    })
    if (r.payment_terms) {
      setQuoteDetails((prev) => ({ ...prev, paymentTerms: String(r.payment_terms) }))
    }
    toast.success('已填入计算器')
    setAiPanelOpen(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sym = getCurrencySymbol(formData.currency)

  const stepTitle = (n: number, title: string) => (
    <h2 className="font-bold text-base flex items-center gap-2 text-gray-900">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
        {n}
      </span>
      {title}
    </h2>
  )

  return (
    <div className="p-8 pt-16 md:pt-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Calculator className="w-6 h-6 shrink-0" />
          <h1 className="text-2xl font-bold">新建报价</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAiPanelOpen(true)} className="shrink-0">
          <Sparkles className="mr-1.5 h-4 w-4 text-blue-500" />
          AI 解析询盘
        </Button>
      </div>

      {/* 单据类型选择 — 放最前面，决定输出目标 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">单据类型：</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['QUOTATION', 'PI'] as const).map((kind) => {
            const labels = { QUOTATION: 'Quotation（报价单）', PI: 'PI（形式发票）' }
            const active = quoteDetails.documentKind === kind
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setQuoteDetails({ ...quoteDetails, documentKind: kind })}
                className={`px-4 py-2 transition-colors font-medium ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {labels[kind]}
              </button>
            )
          })}
        </div>
        <span className="text-xs text-gray-400">
          {quoteDetails.documentKind === 'QUOTATION' ? '用于初次报价，告知客户价格' : '用于确认订单，客户据此付款'}
        </span>
      </div>

      {/* ① 客户（可选） */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {stepTitle(1, '客户（可选）')}
          <p className="text-xs text-gray-500">
            可先算价再选客户。生成 PDF 并保存时需选择已有客户或新建客户。
          </p>
          {!isNewCustomer ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="搜索客户公司名称…"
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value)
                    setSelectedCustomer(null)
                  }}
                />
              </div>
              {customerLoading && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}
              {customerResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {customerResults.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className={`p-3 cursor-pointer hover:bg-gray-50 text-sm ${selectedCustomer?.id === c.id ? 'bg-blue-50' : ''}`}
                    >
                      <div className="font-medium">{c.company_name}</div>
                      {c.contact_name && <div className="text-xs text-gray-500">{c.contact_name}</div>}
                    </div>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="font-medium text-blue-800">已选择：{selectedCustomer.company_name}</div>
                  {lastQuote ? (
                    <div className="text-xs text-blue-600 mt-1">
                      上次报价：{new Date(lastQuote.date).toLocaleDateString('zh-CN')}，{lastQuote.trade_term}，{lastQuote.currency} {lastQuote.total_amount_foreign.toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-xs text-blue-500 mt-1">暂无历史报价</div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex-1 border-t" />
                <span>或</span>
                <div className="flex-1 border-t" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => setIsNewCustomer(true)}>
                + 新建客户
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <Button type="button" variant="ghost" size="sm" className="text-gray-500 -mb-1" onClick={() => setIsNewCustomer(false)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回搜索
              </Button>
              <div>
                <label className="text-sm font-medium">公司名称 *</label>
                <Input
                  className="mt-1"
                  value={newCustomerData.company_name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, company_name: e.target.value })}
                  placeholder="客户公司名称"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">联系人</label>
                  <Input className="mt-1" value={newCustomerData.contact_name} onChange={(e) => setNewCustomerData({ ...newCustomerData, contact_name: e.target.value })} placeholder="联系人" />
                </div>
                <div>
                  <label className="text-sm font-medium">国家</label>
                  <Input className="mt-1" value={newCustomerData.country} onChange={(e) => setNewCustomerData({ ...newCustomerData, country: e.target.value })} placeholder="如 USA" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">邮箱</label>
                  <Input className="mt-1" type="email" value={newCustomerData.email} onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">电话</label>
                  <Input className="mt-1" value={newCustomerData.phone} onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">地址</label>
                <Input className="mt-1" value={newCustomerData.address} onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })} placeholder="公司地址（可选）" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ② 产品与算价 */}
      <Card>
        <CardContent className="p-6 space-y-5">
          {stepTitle(2, '产品与算价')}
            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 space-y-1.5">
              <p className="font-medium text-slate-800">主路径（全行业通用）</p>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                <li>先选下方「整单定价方式」，由系统按工厂价统一算出各行初版卖价。</li>
                <li>某行需要谈死价或单独定价时，再填「对客单价(¥)」——与工厂价同币便于心算；约合目标货币见表内换算列。该行不再套用整单利润率/加价%，仅反推展示利润%。</li>
                <li>整单额外费用（手续费等）建议做 PI 单独费用行，一般不再叠乘到已锁行价上。</li>
              </ol>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
              <div>
                <label className="text-sm font-medium">整单定价方式</label>
                <p className="text-xs text-gray-500 mt-1">先定规则，再在产品表里出数；未填「对客单价(¥)」的行都走这里。</p>
              </div>
              <Select
                value={formData.pricingMode}
                onValueChange={(v) => v && setFormData({ ...formData, pricingMode: v as PricingMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margin">按期望利润率 (%)</SelectItem>
                  <SelectItem value="order_markup_pct">整单统一加价 (%)</SelectItem>
                  <SelectItem value="order_markup_fixed">整单固定加价 (¥) 分摊到各行，并可再加利润率</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.pricingMode === 'margin' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">期望利润率 (%)</label>
                    <Input
                      type="number"
                      value={formData.profitRate}
                      onChange={(e) => setFormData({ ...formData, profitRate: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                )}
                {formData.pricingMode === 'order_markup_pct' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">整单统一加价 (%)</label>
                    <Input
                      type="number"
                      value={formData.orderMarkupPercent}
                      onChange={(e) => setFormData({ ...formData, orderMarkupPercent: e.target.value })}
                      placeholder="8"
                    />
                  </div>
                )}
                {formData.pricingMode === 'order_markup_fixed' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">整单固定加价 (¥)</label>
                      <Input
                        type="number"
                        value={formData.orderMarkupFixed}
                        onChange={(e) => setFormData({ ...formData, orderMarkupFixed: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">分摊后再加利润率 (%)</label>
                      <Input
                        type="number"
                        value={formData.profitRate}
                        onChange={(e) => setFormData({ ...formData, profitRate: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-600 border-t border-gray-200 pt-3">
                <span className="font-medium text-gray-700">行级例外：</span>
                产品表中若填写「对客单价(¥)」，则该行以人民币卖价为准，整单利润率/加价规则不再作用于该行的利润计算（与整单固定加价分摊后的成本底对比后反推利润%）。目标货币单价由汇率换算展示，不参与反推公式。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">产品列表</label>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs min-w-[820px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-500 min-w-[100px]">名称</th>
                      <th className="text-left p-2 font-medium text-gray-500 w-16">型号</th>
                      <th className="text-left p-2 font-medium text-gray-500 w-12">单位</th>
                      <th className="text-right p-2 font-medium text-gray-500 w-20">工厂价(¥)*</th>
                      <th className="text-right p-2 font-medium text-gray-500 w-16">数量*</th>
                      <th className="text-right p-2 font-medium text-gray-500 w-20">小计¥</th>
                      <th
                        className="text-right p-2 font-medium text-gray-500 w-24"
                        title="人民币对客单价；填则覆盖整单规则，仅反推利润%"
                      >
                        对客单价(¥)
                      </th>
                      <th
                        className="text-right p-2 font-medium text-gray-500 w-24"
                        title="由对客单价(¥)×汇率换算，仅作对照"
                      >
                        约合({sym})
                      </th>
                      <th className="text-right p-2 font-medium text-gray-500 w-14">利润%</th>
                      <th className="w-8 p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcProducts.map((row) => {
                      const unit = parseFloat(row.costPrice) || 0
                      const qty = parseFloat(row.quantity) || 0
                      const lineFactory = unit * qty
                      const mr = marginById.get(row.id)
                      const quoteCny = parseFloat(row.quoteUnitCny) || 0
                      const equivForeign =
                        quoteCny > 0 && exchangeRate > 0
                          ? formData.currency === 'CNY'
                            ? quoteCny
                            : quoteCny * exchangeRate
                          : null
                      return (
                        <tr key={row.id} className="border-t">
                          <td className="p-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="从产品库选择"
                                onClick={() => setProductPickerRowId(row.id)}
                                className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                              >
                                <Package className="w-3.5 h-3.5" />
                              </button>
                              <input
                                className="w-full text-xs border rounded px-1 py-0.5 focus:outline-blue-400"
                                value={row.name}
                                onChange={(e) => updateCalcProduct(row.id, 'name', e.target.value)}
                                placeholder="产品名称"
                              />
                            </div>
                          </td>
                          <td className="p-1">
                            <input
                              className="w-full text-xs border rounded px-1 py-0.5 focus:outline-blue-400"
                              value={row.model}
                              onChange={(e) => updateCalcProduct(row.id, 'model', e.target.value)}
                              placeholder="型号"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              className="w-full text-xs border rounded px-1 py-0.5 focus:outline-blue-400"
                              value={row.unit}
                              onChange={(e) => updateCalcProduct(row.id, 'unit', e.target.value)}
                              placeholder="pc"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              className="w-full text-xs border rounded px-1 py-0.5 text-right focus:outline-blue-400"
                              value={row.costPrice}
                              onChange={(e) => updateCalcProduct(row.id, 'costPrice', e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              className="w-full text-xs border rounded px-1 py-0.5 text-right focus:outline-blue-400"
                              value={row.quantity}
                              onChange={(e) => updateCalcProduct(row.id, 'quantity', e.target.value)}
                              placeholder="100"
                            />
                          </td>
                          <td className="p-1 text-right text-gray-600 tabular-nums">
                            {unit > 0 && qty > 0 ? lineFactory.toFixed(2) : '—'}
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              step="any"
                              className="w-full text-xs border rounded px-1 py-0.5 text-right focus:outline-blue-400"
                              value={row.quoteUnitCny}
                              onChange={(e) => updateCalcProduct(row.id, 'quoteUnitCny', e.target.value)}
                              placeholder="可选"
                            />
                          </td>
                          <td className="p-1 text-right text-gray-500 tabular-nums text-[11px]">
                            {equivForeign != null ? (
                              formData.currency === 'CNY' ? (
                                `¥${formatPrice(equivForeign)}`
                              ) : (
                                <>
                                  {sym}
                                  {formatPrice(equivForeign)}
                                </>
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-1 text-right text-gray-600 tabular-nums">
                            {mr != null && unit > 0 && qty > 0 ? `${mr.toFixed(1)}%` : '—'}
                          </td>
                          <td className="p-1 text-center">
                            {calcProducts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCalcProduct(row.id)}
                                className="text-gray-300 hover:text-red-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-t bg-gray-50/90 font-medium text-gray-800">
                      <td colSpan={5} className="p-2 text-right text-xs">
                        工厂成本合计（¥）
                      </td>
                      <td className="p-2 text-right text-xs tabular-nums">
                        {factoryCostTotalCNY > 0 ? factoryCostTotalCNY.toFixed(2) : '—'}
                      </td>
                      <td colSpan={4} className="p-2 text-xs text-gray-500"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addCalcProduct}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Plus className="w-3 h-3" /> 添加产品
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">目标货币</label>
                <Select value={formData.currency} onValueChange={(v) => v && handleCurrencyChange(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-sm text-gray-600">汇率</span>
                    <span className="text-base font-semibold ml-2 text-gray-900">
                      {formData.currency === 'CNY'
                        ? 'CNY 为本位币（无需换算）'
                        : `${formData.currency}/CNY = ${exchangeRate.toFixed(4)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {rateIsFallback
                      ? <span className="text-xs text-amber-500 font-medium">⚠ 估算值，请核实</span>
                      : rateUpdatedAt
                        ? <span className="text-xs text-gray-400">更新于 {formatTime(rateUpdatedAt)}</span>
                        : null
                    }
                    <Button variant="ghost" size="sm" onClick={fetchExchangeRate} disabled={rateLoading}>
                      <RefreshCw className={`w-4 h-4 ${rateLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
              {!multiResultsFactory ? (
                <p className="text-xs text-blue-800/80">填写有效工厂价与数量后显示 EXW 出厂合计。</p>
              ) : (
                <>
                  {multiResultsFactory.orderTotals
                    .filter((r) => r.term === OUTPUT_TRADE_TERM)
                    .map((r) => (
                      <div
                        key={r.term}
                        className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                      >
                        <span className="text-sm font-medium text-blue-900">EXW 出厂合计</span>
                        <div className="text-right">
                          {formData.currency !== 'CNY' ? (
                            <>
                              <span className="text-xl font-semibold text-blue-950 tabular-nums">
                                {sym}
                                {formatPrice(r.priceForeign)}
                              </span>
                              <span className="text-sm text-blue-800/90 ml-2 tabular-nums">
                                （¥{r.priceCNY.toFixed(2)}）
                              </span>
                            </>
                          ) : (
                            <span className="text-xl font-semibold text-blue-950 tabular-nums">
                              ¥{formatPrice(r.priceCNY)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  <p className="text-xs text-blue-800/75 mt-2">
                    含利润；不含国内/海运/目的港/保险（与下方物流报价无关）。
                  </p>
                </>
              )}
            </div>

            {multiResultsFactory &&
              calcProducts.filter((p) => parseFloat(p.costPrice) > 0).length >= 2 && (
                <div className="border rounded-lg p-3 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => setShowDetail((v) => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full"
                  >
                    {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    按产品明细
                  </button>
                  {showDetail && (
                    <div className="mt-3 space-y-2">
                      {multiResultsFactory.byProduct.map(({ productId, results }) => {
                        const calc = calcProducts.find((p) => p.id === productId)
                        if (!calc) return null
                        const r = results.find((r) => r.term === OUTPUT_TRADE_TERM)
                        if (!r) return null
                        const qty = parseFloat(calc.quantity) || 1
                        return (
                          <div
                            key={productId}
                            className="flex items-center justify-between text-xs text-gray-700 bg-white rounded px-3 py-2 border"
                          >
                            <span className="font-medium">
                              {calc.name || '产品'}
                              {calc.model ? ` (${calc.model})` : ''}
                            </span>
                            <span className="text-gray-500">
                              {sym}
                              {formatPrice(r.priceForeign)}/{calc.unit} × {qty} ={' '}
                              <span className="font-semibold text-blue-700">
                                {sym}
                                {(r.priceForeign * qty).toFixed(2)}
                              </span>
                            </span>
                          </div>
                        )
                      })}
                      <div className="flex justify-between text-xs font-bold border-t pt-2 px-3">
                        <span>合计</span>
                        <span className="text-blue-700">
                          {sym}
                          {(
                            multiResultsFactory.orderTotals.find((r) => r.term === OUTPUT_TRADE_TERM)
                              ?.priceForeign || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </CardContent>
        </Card>

        {/* ③ PDF 明细行：在填物流前确认列表/货柜分组，便于与海运与术语报价对齐 */}
        <Card>
          <CardContent className="p-6 space-y-3">
            {stepTitle(3, 'PDF 明细行（列表或按货柜）')}
            <p className="text-xs text-gray-500">
              与 ② 中产品行一一对应；若按货柜分组，建议先在此标好柜型/分组，再填下方物流费用，思路更顺。
            </p>
            {!multiResultsFactory ? (
              <p className="text-xs text-gray-400">请先完成 ② 产品与算价中的有效成本与数量。</p>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-xs">
                      <button
                        type="button"
                        className={`rounded px-2 py-1 ${quoteLayoutMode === 'product_list' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                        onClick={() => {
                          setQuoteLayoutMode('product_list')
                          setPdfProducts((prev) => prev.filter((r) => !r.isContainerHeader))
                        }}
                      >
                        产品列表
                      </button>
                      <button
                        type="button"
                        className={`rounded px-2 py-1 ${quoteLayoutMode === 'container_group' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                        onClick={() => {
                          setQuoteLayoutMode('container_group')
                          setPdfProducts((prev) => {
                            if (prev.some((r) => r.isContainerHeader)) return prev
                            return [emptyContainerHeaderRow(), ...prev]
                          })
                        }}
                      >
                        按货柜分组
                      </button>
                    </div>
                    {quoteLayoutMode === 'container_group' && (
                      <button
                        type="button"
                        className="text-xs text-amber-700 hover:underline"
                        onClick={() => setPdfProducts((prev) => [...prev, emptyContainerHeaderRow()])}
                      >
                        + 货柜标题
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        const price = selectedTradeResult?.priceForeign || 0
                        setPdfProducts((prev) => [...prev, emptyProductPdfRow(price)])
                      }}
                    >
                      + 添加行
                    </button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2 font-medium text-gray-500">产品名称</th>
                        <th className="text-right p-2 font-medium text-gray-500 w-16">数量</th>
                        <th className="text-right p-2 font-medium text-gray-500 w-20">单价</th>
                        <th className="text-right p-2 font-medium text-gray-500 w-20">小计</th>
                        <th className="p-2 w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfProducts.map((row, idx) =>
                        row.isContainerHeader ? (
                          <tr key={idx} className="border-t bg-amber-50/80">
                            <td className="p-1" colSpan={4}>
                              <input
                                className="w-full text-xs border border-amber-200 rounded px-1 py-0.5 focus:outline-blue-400 font-medium"
                                value={row.name}
                                onChange={(e) => {
                                  const u = [...pdfProducts]
                                  u[idx] = { ...u[idx], name: e.target.value }
                                  setPdfProducts(u)
                                }}
                                placeholder="货柜 / 分组标题（如 1×40HQ）"
                              />
                            </td>
                            <td className="p-1 text-center">
                              {pdfProducts.length > 1 && (
                                <button
                                  type="button"
                                  className="text-red-400 hover:text-red-600"
                                  onClick={() => setPdfProducts((prev) => prev.filter((_, i) => i !== idx))}
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          <tr key={idx} className="border-t">
                            <td className="p-1">
                              <input
                                className="w-full text-xs border rounded px-1 py-0.5 focus:outline-blue-400"
                                value={row.name}
                                onChange={(e) => {
                                  const u = [...pdfProducts]
                                  u[idx] = { ...u[idx], name: e.target.value }
                                  setPdfProducts(u)
                                }}
                                placeholder="产品名称"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                className="w-full text-xs border rounded px-1 py-0.5 text-right focus:outline-blue-400"
                                value={row.qty}
                                onChange={(e) => {
                                  const qty = parseFloat(e.target.value) || 1
                                  const u = [...pdfProducts]
                                  u[idx] = {
                                    ...u[idx],
                                    qty,
                                    amount_foreign: qty * u[idx].unit_price_foreign,
                                  }
                                  setPdfProducts(u)
                                }}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                className="w-full text-xs border rounded px-1 py-0.5 text-right focus:outline-blue-400"
                                value={row.unit_price_foreign.toFixed(4)}
                                onChange={(e) => {
                                  const price = parseFloat(e.target.value) || 0
                                  const u = [...pdfProducts]
                                  u[idx] = {
                                    ...u[idx],
                                    unit_price_foreign: price,
                                    amount_foreign: price * u[idx].qty,
                                  }
                                  setPdfProducts(u)
                                }}
                              />
                            </td>
                            <td className="p-2 text-right font-medium">
                              {sym}
                              {row.amount_foreign.toFixed(2)}
                            </td>
                            <td className="p-1 text-center">
                              {pdfProducts.length > 1 && (
                                <button
                                  type="button"
                                  className="text-red-400 hover:text-red-600"
                                  onClick={() => setPdfProducts((prev) => prev.filter((_, i) => i !== idx))}
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={3} className="p-2 text-right text-xs font-bold text-gray-600">
                          合计
                        </td>
                        <td className="p-2 text-right text-xs font-bold text-blue-700">
                          {sym}
                          {pdfProducts
                            .filter((p) => !p.isContainerHeader)
                            .reduce((s, p) => s + p.amount_foreign, 0)
                            .toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-gray-400">
                  {quoteLayoutMode === 'container_group'
                    ? '货柜标题行仅用于 PDF 分组与小计；产品行顺序仍与 ② 中成本表一致。填 ④ 物流时可将海运费等按柜或按票与你的分组对照。'
                    : '与 ② 成本行按顺序对应；可添加额外明细行。保存/生成 PDF 时按后面「价格板块」选项重算单价。'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ④ 物流费用 + 物流术语结果 */}
        <Card>
          <CardContent className="p-6 space-y-4">
            {stepTitle(4, '物流费用与报价（贸易术语）')}
            <p className="text-xs text-gray-500">国内、海运、目的港、保险按数量分摊后，计入下列各术语总价。</p>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">物流费用</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">国内费用 (CNY)</label>
                  <Input
                    type="number"
                    value={formData.domesticCost}
                    onChange={(e) => setFormData({ ...formData, domesticCost: e.target.value })}
                    placeholder="拖车费+港杂费"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">海运费 (CNY)</label>
                  <Input
                    type="number"
                    value={formData.freight}
                    onChange={(e) => setFormData({ ...formData, freight: e.target.value })}
                    placeholder="海运费总额"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">目的港费用 (CNY)</label>
                  <Input
                    type="number"
                    value={formData.destinationCost}
                    onChange={(e) => setFormData({ ...formData, destinationCost: e.target.value })}
                    placeholder="DAP/DPU/DDP用"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">保险费率 (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.insuranceRate}
                    onChange={(e) => setFormData({ ...formData, insuranceRate: e.target.value })}
                    placeholder="CIF/CIP用"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800">报价结果（物流术语）</h3>
                <span className="text-xs text-gray-400">勾选要展示的术语</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {TRADE_TERMS.filter((t) => t.code !== 'EXW').map((t) => (
                  <label key={t.code} className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-gray-300"
                      checked={visibleLogisticsTerms[t.code] ?? false}
                      onChange={(e) =>
                        setVisibleLogisticsTerms((prev) => ({ ...prev, [t.code]: e.target.checked }))
                      }
                    />
                    <span>{t.code}</span>
                  </label>
                ))}
              </div>
              {!multiResultsLogistics ? (
                <p className="text-xs text-gray-400">请输入有效成本与数量</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 font-medium text-gray-500">术语</th>
                        <th className="text-right p-2 font-medium text-gray-500">{formData.currency} 合计</th>
                        <th className="text-right p-2 font-medium text-gray-500">CNY 合计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multiResultsLogistics.orderTotals
                        .filter((r) => r.term !== 'EXW' && visibleLogisticsTerms[r.term])
                        .map((r) => (
                          <tr key={r.term} className="border-b">
                            <td className="p-2">
                              <span className="font-mono font-medium">{r.term}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {TRADE_TERMS.find((t) => t.code === r.term)?.desc}
                              </span>
                            </td>
                            <td className="p-2 text-right font-medium">
                              {sym}
                              {formatPrice(r.priceForeign)}
                            </td>
                            <td className="p-2 text-right text-gray-500">¥{r.priceCNY.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ④ 附：散货/整柜参考（不计入主表） */}
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLCLFCL"
                checked={showLCLFCL}
                onChange={(e) => setShowLCLFCL(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="showLCLFCL" className="text-sm font-medium">
                阶梯参考（散货 vs 整柜）
              </label>
            </div>
            {showLCLFCL && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">散货数量</label>
                    <Input type="number" value={lclData.quantity} onChange={(e) => setLclData({ ...lclData, quantity: e.target.value })} placeholder="500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">散货海运费</label>
                    <Input type="number" value={lclData.freight} onChange={(e) => setLclData({ ...lclData, freight: e.target.value })} placeholder="800" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">整柜数量</label>
                    <Input type="number" value={fclData.quantity} onChange={(e) => setFclData({ ...fclData, quantity: e.target.value })} placeholder="2000" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">整柜海运费</label>
                    <Input type="number" value={fclData.freight} onChange={(e) => setFclData({ ...fclData, freight: e.target.value })} placeholder="1500" />
                  </div>
                </div>
                {discount > 0 && (
                  <div className="text-green-600 text-sm font-medium">
                    整柜比散货便宜 {discount.toFixed(1)}%
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ⑤ 输出单证 + PDF */}
        {!multiResultsFactory ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                请先填写有效的产品成本与数量，再查看出厂价与输出选项。
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-5 space-y-4">
                  {stepTitle(5, '输出单证与价格板块')}
                  <p className="text-xs text-gray-500">
                    选择价格板块（出厂价 / 物流术语价 / 双板块），并确认贸易术语后下载 PDF。
                  </p>
                  <div className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">当前单据类型：</span>
                    <span className="font-semibold text-blue-700">
                      {quoteDetails.documentKind === 'QUOTATION' ? 'Quotation（报价单）' : 'PI（形式发票）'}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-xs text-blue-600 underline"
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                      在顶部修改
                    </button>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <h3 className="font-semibold text-sm text-gray-800">价格板块（用于 PDF 行价与摘要）</h3>
                    <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="piScope"
                        className="w-4 h-4"
                        checked={piOutputScope === 'exw'}
                        onChange={() => setPiOutputScope('exw')}
                      />
                      仅出厂价（EXW）
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="piScope"
                        className="w-4 h-4"
                        checked={piOutputScope === 'logistics'}
                        onChange={() => setPiOutputScope('logistics')}
                      />
                      仅物流贸易术语价（如 FOB / DAP）
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="piScope"
                        className="w-4 h-4"
                        checked={piOutputScope === 'both'}
                        onChange={() => setPiOutputScope('both')}
                      />
                      出厂价 + 物流术语（双板块）
                    </label>
                    </div>
                  {(piOutputScope === 'logistics' || piOutputScope === 'both') && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">物流价主术语（PDF 行价 / 摘要）</label>
                      <Select value={piLogisticsTerm} onValueChange={(v) => v && setPiLogisticsTerm(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRADE_TERMS.filter((t) => t.code !== 'EXW').map((t) => (
                            <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {piOutputScope === 'both' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">双选时输出</label>
                        <div className="flex flex-col gap-2 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="piDual"
                              className="w-4 h-4"
                              checked={piDualPdfMode === 'merged'}
                              onChange={() => setPiDualPdfMode('merged')}
                            />
                            合并为一份 PDF（含双术语摘要）
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="piDual"
                              className="w-4 h-4"
                              checked={piDualPdfMode === 'two_pdfs'}
                              onChange={() => setPiDualPdfMode('two_pdfs')}
                            />
                            分两份 PDF 下载
                          </label>
                        </div>
                      </div>
                      {piDualPdfMode === 'merged' && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-600">合并 PDF 产品行单价术语</label>
                          <Select value={piMergedLineTerm} onValueChange={(v) => v && setPiMergedLineTerm(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRADE_TERMS.map((t) => (
                                <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full" size="lg" onClick={openQuoteDialog}>
                <FileText className="mr-2 h-4 w-4" />
                下一步：填写条款并导出
              </Button>
            </>
          )}

      {/* ── Product Library Picker Dialog */}
      <Dialog open={productPickerRowId !== null} onOpenChange={(open) => { if (!open) setProductPickerRowId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>从产品库选择</DialogTitle>
            <DialogDescription>选择产品后自动填充名称和成本价</DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto">
            {libraryProducts.length === 0 ? (
              <p className="text-center py-4 text-gray-500">暂无产品，请先在产品库添加</p>
            ) : (
              <div className="space-y-2">
                {libraryProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleLibraryProductSelect(p)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-500">¥{p.cost_price} {p.model && `- ${p.model}`}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Quote Generation Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{quoteStep === 1 ? '第一步：选择客户' : '第二步：填写条款'}</DialogTitle>
            <DialogDescription>
              {quoteStep === 1 ? '搜索已有客户，或新建客户' : '填写条款后选择导出为 Excel 或 PDF'}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Customer Selection */}
          {quoteStep === 1 && (
            <div className="space-y-4">
              {!isNewCustomer ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="pl-9"
                      placeholder="搜索客户公司名称..."
                      value={customerQuery}
                      onChange={(e) => { setCustomerQuery(e.target.value); setSelectedCustomer(null) }}
                    />
                  </div>

                  {customerLoading && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  )}

                  {customerResults.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {customerResults.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedCustomer?.id === c.id ? 'bg-blue-50' : ''}`}
                        >
                          <div className="font-medium text-sm">{c.company_name}</div>
                          {c.contact_name && <div className="text-xs text-gray-500">{c.contact_name}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="font-medium text-sm text-blue-800">已选择：{selectedCustomer.company_name}</div>
                      {lastQuote ? (
                        <div className="text-xs text-blue-600 mt-1">
                          上次报价：{new Date(lastQuote.date).toLocaleDateString('zh-CN')}，{lastQuote.trade_term}，{lastQuote.currency} {lastQuote.total_amount_foreign.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-xs text-blue-500 mt-1">暂无历史报价</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="flex-1 border-t" /><span>或</span><div className="flex-1 border-t" />
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setIsNewCustomer(true)}>+ 新建客户</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="text-gray-500 -mb-2" onClick={() => setIsNewCustomer(false)}>
                    <ArrowLeft className="w-4 h-4 mr-1" />返回搜索
                  </Button>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">公司名称 *</label>
                      <Input className="mt-1" value={newCustomerData.company_name} onChange={(e) => setNewCustomerData({ ...newCustomerData, company_name: e.target.value })} placeholder="客户公司名称" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">联系人</label>
                        <Input className="mt-1" value={newCustomerData.contact_name} onChange={(e) => setNewCustomerData({ ...newCustomerData, contact_name: e.target.value })} placeholder="联系人姓名" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">国家</label>
                        <Input className="mt-1" value={newCustomerData.country} onChange={(e) => setNewCustomerData({ ...newCustomerData, country: e.target.value })} placeholder="如 USA" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">邮箱</label>
                        <Input className="mt-1" type="email" value={newCustomerData.email} onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })} placeholder="email@example.com" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">电话</label>
                        <Input className="mt-1" value={newCustomerData.phone} onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })} placeholder="WhatsApp 等" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">地址</label>
                      <Input className="mt-1" value={newCustomerData.address} onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })} placeholder="公司地址（可选）" />
                    </div>
                  </div>
                </>
              )}

              <Button
                className="w-full"
                disabled={(!selectedCustomer && !isNewCustomer) || (isNewCustomer && !newCustomerData.company_name.trim())}
                onClick={() => setQuoteStep(2)}
              >
                下一步
              </Button>
            </div>
          )}

          {/* Step 2: Quote Details */}
          {quoteStep === 2 && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" className="text-gray-500 -mb-2" onClick={() => setQuoteStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />返回选择客户
              </Button>

              {/* Company info status */}
              {userProfile?.company_name ? (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                  <span className="font-medium">{userProfile.company_name}</span>
                  <span className="text-blue-400">·</span>
                  <span>公司信息已加载，将自动填入单据抬头</span>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <span>⚠️ 未检测到公司信息，导出的单据抬头将为空</span>
                  <a href="/settings" target="_blank" className="underline font-medium ml-auto">去设置 →</a>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">客户：</span>
                <span className="font-medium">{selectedCustomer?.company_name || newCustomerData.company_name}</span>
                {lastQuote && (
                  <div className="text-xs text-blue-600 mt-1">
                    上次报价：{new Date(lastQuote.date).toLocaleDateString('zh-CN')}，{lastQuote.trade_term} {lastQuote.currency} {lastQuote.total_amount_foreign.toFixed(2)}
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                单据类型：
                <span className="font-semibold text-blue-700 ml-1">
                  {quoteDetails.documentKind === 'QUOTATION' ? 'Quotation（报价单）' : 'PI（形式发票）'}
                </span>
              </p>

              {quoteDetails.documentKind === 'PI' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">PO#（客户订单号）</label>
                    <Input
                      value={quoteDetails.poNumber}
                      onChange={(e) =>
                        setQuoteDetails({ ...quoteDetails, poNumber: e.target.value })
                      }
                      placeholder="Buyer PO number（可空）"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">存款比例（%）</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={quoteDetails.depositPercent}
                      onChange={(e) =>
                        setQuoteDetails({
                          ...quoteDetails,
                          depositPercent: e.target.value,
                        })
                      }
                      placeholder="如 30"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">自定义单号（可选）</label>
                <Input
                  value={quoteDetails.referenceNumber}
                  onChange={(e) => setQuoteDetails({ ...quoteDetails, referenceNumber: e.target.value })}
                  placeholder="留空则使用系统编号 LS-..."
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={quoteDetails.sellerVisiblePi}
                  onChange={(e) => setQuoteDetails({ ...quoteDetails, sellerVisiblePi: e.target.checked })}
                />
                PDF 上显示我司名称与抬头
              </label>
              {quoteDetails.documentKind === 'CI' && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={quoteDetails.sellerVisibleCi}
                    onChange={(e) => setQuoteDetails({ ...quoteDetails, sellerVisibleCi: e.target.checked })}
                  />
                  CI 上显示我司名称与抬头
                </label>
              )}

              {/* Payment Terms */}
              <div className="space-y-2">
                <label className="text-sm font-medium">付款条件</label>
                <Select value={quoteDetails.paymentTerms} onValueChange={(v) => setQuoteDetails({ ...quoteDetails, paymentTerms: v || quoteDetails.paymentTerms })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">交货期</label>
                  <Input value={quoteDetails.deliveryTime} onChange={(e) => setQuoteDetails({ ...quoteDetails, deliveryTime: e.target.value })} placeholder="如 30 days after deposit" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">有效期（天）</label>
                  <Input type="number" value={quoteDetails.validityDays} onChange={(e) => setQuoteDetails({ ...quoteDetails, validityDays: parseInt(e.target.value) || 30 })} placeholder="30" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">包装方式</label>
                <Input value={quoteDetails.packing} onChange={(e) => setQuoteDetails({ ...quoteDetails, packing: e.target.value })} placeholder="如 Standard export carton" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">备注</label>
                <Textarea value={quoteDetails.remarks} onChange={(e) => setQuoteDetails({ ...quoteDetails, remarks: e.target.value })} placeholder="其他说明..." rows={3} />
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleGeneratePDF('xlsx')}
                    disabled={generatingXlsx || generatingPdf || previewing}
                  >
                    {generatingXlsx ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    {generatingXlsx ? '生成中…' : '保存并下载 Excel'}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleGeneratePDF('pdf')}
                    disabled={generatingPdf || generatingXlsx || previewing}
                  >
                    {generatingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    {generatingPdf ? '生成中…' : '保存并下载 PDF'}
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={handlePreviewPDF} disabled={previewing || generatingPdf || generatingXlsx}>
                  {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  预览 PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI 解析询盘侧边面板 */}
      <AiSidePanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        title="AI 解析询盘"
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">粘贴客户询盘邮件，AI 自动提取产品、数量、贸易术语等关键信息，一键填入计算器。</p>

          <div className="space-y-2">
            <label className="text-sm font-medium">询盘邮件内容</label>
            <Textarea
              placeholder="粘贴英文或中文询盘邮件..."
              rows={8}
              value={inquiryText}
              onChange={(e) => setInquiryText(e.target.value)}
              className="resize-none text-sm"
            />
          </div>

          <Button className="w-full" onClick={handleParseInquiry} disabled={inquiryParsing}>
            {inquiryParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            AI 解析
          </Button>

          {inquiryResult && (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-2">
                {!!inquiryResult.raw_summary && (
                  <p className="text-gray-600 text-xs border-b pb-2 mb-2">{String(inquiryResult.raw_summary)}</p>
                )}
                {[
                  { label: '产品', key: 'product_name' },
                  { label: '数量', key: 'quantity', suffix: inquiryResult.unit ? ` ${String(inquiryResult.unit)}` : '' },
                  { label: '规格', key: 'specs' },
                  { label: '贸易术语', key: 'trade_term' },
                  { label: '目的地', key: 'destination' },
                  { label: '付款方式', key: 'payment_terms' },
                  { label: '交货要求', key: 'delivery_deadline' },
                  { label: '备注', key: 'notes' },
                ].map(({ label, key, suffix }) =>
                  inquiryResult[key] != null ? (
                    <div key={key} className="flex gap-2">
                      <span className="text-gray-400 w-20 flex-shrink-0">{label}</span>
                      <span className="text-gray-800 font-medium">{String(inquiryResult[key])}{suffix || ''}</span>
                    </div>
                  ) : null
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={handleFillFromInquiry}>
                填入计算器
              </Button>
            </div>
          )}
        </div>
      </AiSidePanel>
    </div>
  )
}
