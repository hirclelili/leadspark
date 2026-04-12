'use client'

import React, { useState, useEffect, useMemo } from 'react'
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

const currencies = [
  { value: 'USD', label: 'USD - 美元' },
  { value: 'EUR', label: 'EUR - 欧元' },
  { value: 'GBP', label: 'GBP - 英镑' },
  { value: 'JPY', label: 'JPY - 日元' },
  { value: 'AUD', label: 'AUD - 澳元' },
  { value: 'CAD', label: 'CAD - 加元' },
  { value: 'AED', label: 'AED - 迪拉姆' },
  { value: 'SGD', label: 'SGD - 新加坡元' },
]

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

// One row in the calculator's product input table
interface CalcProductRow {
  id: string
  name: string
  model: string
  unit: string
  costPrice: string  // CNY per unit, string for input
  quantity: string   // quantity, string for input
}

interface MultiProductQuoteResult {
  byProduct: { productId: string; results: QuoteResult[] }[]
  orderTotals: QuoteResult[]  // sum across all products per Incoterm
}

interface PDFProductRow {
  name: string
  model: string
  specs: string
  qty: number
  unit: string
  unit_price_foreign: number
  amount_foreign: number
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
  products: { id: string; costPrice: number; quantity: number }[],
  domesticCost: number,
  freight: number,
  destinationCost: number,
  insuranceRate: number,
  profitRate: number,
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
      profitRate,
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

function calculateDiscount(lclFreight: number, fclFreight: number, lclQty: number): number {
  if (lclFreight <= 0) return 0
  const lclPrice = (lclFreight / lclQty) * 1.1
  const fclPrice = (fclFreight / lclQty) * 1.1
  if (lclPrice <= 0) return 0
  return ((lclPrice - fclPrice) / lclPrice) * 100
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
    { id: crypto.randomUUID(), name: '', model: '', unit: 'pc', costPrice: '', quantity: '100' },
  ])
  const [productPickerRowId, setProductPickerRowId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    domesticCost: '0',
    freight: '0',
    destinationCost: '0',
    insuranceRate: '0.3',
    profitRate: '10',
    currency: 'USD',
  })
  const [showLCLFCL, setShowLCLFCL] = useState(false)
  const [lclData, setLclData] = useState({ quantity: '500', freight: '800' })
  const [fclData, setFclData] = useState({ quantity: '2000', freight: '1500' })
  const [showDetail, setShowDetail] = useState(false)

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
    tradeTerm: 'FOB',
    type: 'QUOTATION' as 'QUOTATION' | 'PI',
    paymentTerms: 'T/T 30% deposit, 70% before shipment',
    deliveryTime: '30 days after deposit',
    packing: '',
    remarks: '',
    validityDays: 30,
  })
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [pdfProducts, setPdfProducts] = useState<PDFProductRow[]>([])

  // ── AI Side Panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [inquiryText, setInquiryText] = useState('')
  const [inquiryParsing, setInquiryParsing] = useState(false)
  const [inquiryResult, setInquiryResult] = useState<Record<string, unknown> | null>(null)

  // ── Computed values
  const multiResults = useMemo(() => {
    const valid = calcProducts
      .map((p) => ({
        id: p.id,
        costPrice: parseFloat(p.costPrice) || 0,
        quantity: parseFloat(p.quantity) || 0,
      }))
      .filter((p) => p.costPrice > 0 && p.quantity > 0)

    if (valid.length === 0) return null

    return calculateMultiProductQuote(
      valid,
      parseFloat(formData.domesticCost) || 0,
      parseFloat(formData.freight) || 0,
      parseFloat(formData.destinationCost) || 0,
      parseFloat(formData.insuranceRate) || 0.3,
      parseFloat(formData.profitRate) || 10,
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
    () => multiResults?.orderTotals.find((r) => r.term === quoteDetails.tradeTerm) || null,
    [multiResults, quoteDetails.tradeTerm]
  )

  // ── Effects
  useEffect(() => {
    fetchLibraryProducts()
    fetchExchangeRate()

    // Load draft from "复用此报价" or localStorage auto-save
    const draftJson = localStorage.getItem('leadspark_quote_draft')
    if (draftJson) {
      try {
        const draft = JSON.parse(draftJson)
        if (draft.calcProducts) setCalcProducts(draft.calcProducts)
        if (draft.formData) setFormData((prev) => ({ ...prev, ...draft.formData }))
        if (draft.quoteDetails) setQuoteDetails((prev) => ({ ...prev, ...draft.quoteDetails }))
        localStorage.removeItem('leadspark_quote_draft')
      } catch { /* ignore */ }
    } else {
      // Restore auto-saved calculator params (but not when loading a draft)
      const savedParams = localStorage.getItem('leadspark_calc_params')
      if (savedParams) {
        try {
          const params = JSON.parse(savedParams)
          setFormData((prev) => ({ ...prev, ...params }))
        } catch { /* ignore */ }
      }
      const savedProducts = localStorage.getItem('leadspark_calc_products')
      if (savedProducts) {
        try {
          setCalcProducts(JSON.parse(savedProducts))
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

  // Auto-add ocean freight remark for CIF/CFR terms
  useEffect(() => {
    const oceanNote = 'Ocean freight is subject to actual rate at time of shipment.'
    const isCIF = ['CIF', 'CIP', 'CFR', 'CPT'].includes(quoteDetails.tradeTerm)
    setQuoteDetails((prev) => {
      const hasNote = prev.remarks.includes(oceanNote)
      if (isCIF && !hasNote) return { ...prev, remarks: prev.remarks ? `${prev.remarks}\n${oceanNote}` : oceanNote }
      if (!isCIF && hasNote) return { ...prev, remarks: prev.remarks.replace(`\n${oceanNote}`, '').replace(oceanNote, '').trim() }
      return prev
    })
  }, [quoteDetails.tradeTerm])

  // Sync pdfProducts prices when trade term or multiResults changes
  useEffect(() => {
    if (!multiResults || !quoteDialogOpen) return
    const validCalc = calcProducts.filter((p) => parseFloat(p.costPrice) > 0 && parseFloat(p.quantity) > 0)
    setPdfProducts((prev) =>
      prev.map((row, idx) => {
        const calc = validCalc[idx]
        if (!calc) return row
        const bp = multiResults.byProduct.find((b) => b.productId === calc.id)
        const tr = bp?.results.find((r) => r.term === quoteDetails.tradeTerm)
        if (!tr) return row
        const qty = parseFloat(calc.quantity) || 1
        return { ...row, unit_price_foreign: tr.priceForeign, amount_foreign: tr.priceForeign * qty }
      })
    )
  }, [multiResults, quoteDetails.tradeTerm, quoteDialogOpen])

  // ── Functions
  const fetchLibraryProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100')
      const data = await res.json()
      setLibraryProducts(data.products || [])
    } catch { /* ignore */ }
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
      setExchangeRate(data.rate || 0.14)
      setRateUpdatedAt(data.updatedAt || '')
    } catch { /* ignore */ } finally { setRateLoading(false) }
  }

  const handleCurrencyChange = async (currency: string) => {
    setFormData({ ...formData, currency })
    setRateLoading(true)
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCurrency: currency }),
      })
      const data = await res.json()
      setExchangeRate(data.rate || 0.14)
      setRateUpdatedAt(data.updatedAt || '')
    } catch { /* ignore */ } finally { setRateLoading(false) }
  }

  const addCalcProduct = () => {
    setCalcProducts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', model: '', unit: 'pc', costPrice: '', quantity: '100' },
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

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }
    return symbols[currency] || '$'
  }

  const openQuoteDialog = async () => {
    setQuoteStep(1)
    setSelectedCustomer(null)
    setIsNewCustomer(false)
    setCustomerQuery('')
    setCustomerResults([])
    setLastQuote(null)
    setNewCustomerData({ company_name: '', contact_name: '', email: '', phone: '', country: '', address: '' })

    try {
      const res = await fetch('/api/user-profile')
      const profile = await res.json()
      if (profile) {
        setUserProfile(profile)
        setQuoteDetails((prev) => ({
          ...prev,
          paymentTerms: profile.default_payment_terms || prev.paymentTerms,
          validityDays: profile.default_validity || prev.validityDays,
        }))
      }
    } catch { /* use defaults */ }

    // Initialize pdfProducts from calcProducts
    const validCalc = calcProducts.filter((p) => parseFloat(p.costPrice) > 0 && parseFloat(p.quantity) > 0)
    const rows: PDFProductRow[] = validCalc.map((p) => ({
      name: p.name || '产品',
      model: p.model,
      specs: '',
      qty: parseFloat(p.quantity) || 1,
      unit: p.unit || 'pc',
      unit_price_foreign: 0, // filled by trade-term sync effect
      amount_foreign: 0,
    }))
    setPdfProducts(rows.length > 0 ? rows : [{ name: '', model: '', specs: '', qty: 1, unit: 'pc', unit_price_foreign: 0, amount_foreign: 0 }])

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

  const handleGeneratePDF = async () => {
    if (!selectedCustomer && !isNewCustomer) { toast.error('请选择或新建客户'); return }
    if (isNewCustomer && !newCustomerData.company_name.trim()) { toast.error('请填写客户公司名称'); return }
    if (!selectedTradeResult) { toast.error('请先填写成本信息并计算报价'); return }
    if (pdfProducts.length === 0 || pdfProducts.some((p) => !p.name.trim())) { toast.error('请填写所有产品名称'); return }

    setGenerating(true)
    try {
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

      const totalForeign = pdfProducts.reduce((s, p) => s + p.amount_foreign, 0)
      const totalCNY = totalForeign / exchangeRate

      const validCalc = calcProducts.filter((p) => parseFloat(p.costPrice) > 0)
      const productsForDB = pdfProducts.map((p, idx) => ({
        name: p.name,
        model: p.model || undefined,
        qty: p.qty,
        unit: p.unit,
        cost_price: parseFloat(validCalc[idx]?.costPrice || '0'),
        unit_price_foreign: p.unit_price_foreign,
        amount_foreign: p.amount_foreign,
      }))

      const saveRes = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          trade_term: quoteDetails.tradeTerm,
          currency: formData.currency,
          exchange_rate: exchangeRate,
          products: productsForDB,
          costs: {
            domestic_cost: parseFloat(formData.domesticCost) || 0,
            freight: parseFloat(formData.freight) || 0,
            destination_cost: parseFloat(formData.destinationCost) || 0,
            insurance_rate: parseFloat(formData.insuranceRate) || 0.3,
            profit_rate: parseFloat(formData.profitRate) || 10,
          },
          total_amount_foreign: totalForeign,
          total_amount_cny: totalCNY,
          payment_terms: quoteDetails.paymentTerms,
          delivery_time: quoteDetails.deliveryTime,
          validity_days: quoteDetails.validityDays,
          packing: quoteDetails.packing,
          remarks: quoteDetails.remarks,
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

      const { pdf } = await import('@react-pdf/renderer')
      const { QuotationPDF } = await import('@/components/pdf/QuotationPDF')

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const element = React.createElement(QuotationPDF, {
        companyName: userProfile?.company_name || 'Your Company',
        companyNameCn: userProfile?.company_name_cn,
        address: userProfile?.address,
        phone: userProfile?.phone,
        email: userProfile?.email,
        website: userProfile?.website,
        logoUrl: userProfile?.logo_url,
        bankName: userProfile?.bank_name,
        bankAccount: userProfile?.bank_account,
        bankSwift: userProfile?.bank_swift,
        bankBeneficiary: userProfile?.bank_beneficiary,
        clientName: customerName,
        clientContact: customerContact || undefined,
        clientAddress: customerAddress || undefined,
        quotationNumber: savedQuote.quotation_number,
        date: today,
        validityDays: quoteDetails.validityDays,
        tradeTerm: quoteDetails.tradeTerm,
        currency: formData.currency,
        products: pdfProducts.map((p) => ({ name: p.name, model: p.model || undefined, specs: p.specs || undefined, qty: p.qty, unit: p.unit, unit_price_foreign: p.unit_price_foreign, amount_foreign: p.amount_foreign })),
        totalAmount: totalForeign,
        paymentTerms: quoteDetails.paymentTerms,
        deliveryTime: quoteDetails.deliveryTime,
        packing: quoteDetails.packing || undefined,
        remarks: quoteDetails.remarks || undefined,
        type: quoteDetails.type,
      })

      const blob = await pdf(element).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${savedQuote.quotation_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`报价单 ${savedQuote.quotation_number} 已生成并保存`)
      setQuoteDialogOpen(false)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const handlePreviewPDF = async () => {
    if (!selectedCustomer && !isNewCustomer) { toast.error('请先选择客户'); return }
    if (!selectedTradeResult) { toast.error('请先填写成本信息并计算报价'); return }
    if (pdfProducts.length === 0 || pdfProducts.some((p) => !p.name.trim())) { toast.error('请填写所有产品名称'); return }

    setPreviewing(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { QuotationPDF } = await import('@/components/pdf/QuotationPDF')

      const customerName = selectedCustomer?.company_name || newCustomerData.company_name
      const customerContact = selectedCustomer?.contact_name || newCustomerData.contact_name || ''
      const customerAddress = selectedCustomer?.address || newCustomerData.address || ''
      const totalForeign = pdfProducts.reduce((s, p) => s + p.amount_foreign, 0)
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

      const element = React.createElement(QuotationPDF, {
        companyName: userProfile?.company_name || 'Your Company',
        companyNameCn: userProfile?.company_name_cn,
        address: userProfile?.address,
        phone: userProfile?.phone,
        email: userProfile?.email,
        website: userProfile?.website,
        logoUrl: userProfile?.logo_url,
        bankName: userProfile?.bank_name,
        bankAccount: userProfile?.bank_account,
        bankSwift: userProfile?.bank_swift,
        bankBeneficiary: userProfile?.bank_beneficiary,
        clientName: customerName,
        clientContact: customerContact || undefined,
        clientAddress: customerAddress || undefined,
        quotationNumber: 'PREVIEW',
        date: today,
        validityDays: quoteDetails.validityDays,
        tradeTerm: quoteDetails.tradeTerm,
        currency: formData.currency,
        products: pdfProducts.map((p) => ({ name: p.name, model: p.model || undefined, specs: p.specs || undefined, qty: p.qty, unit: p.unit, unit_price_foreign: p.unit_price_foreign, amount_foreign: p.amount_foreign })),
        totalAmount: totalForeign,
        paymentTerms: quoteDetails.paymentTerms,
        deliveryTime: quoteDetails.deliveryTime,
        packing: quoteDetails.packing || undefined,
        remarks: quoteDetails.remarks || undefined,
        type: quoteDetails.type,
      })

      const blob = await pdf(element).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 5000)
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
    if (r.trade_term) {
      const term = String(r.trade_term).toUpperCase()
      const valid = TRADE_TERMS.map((t) => t.code)
      if (valid.includes(term)) {
        setQuoteDetails((prev) => ({ ...prev, tradeTerm: term }))
      }
    }
    if (r.payment_terms) {
      setQuoteDetails((prev) => ({ ...prev, paymentTerms: String(r.payment_terms) }))
    }
    toast.success('已填入计算器')
    setAiPanelOpen(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sym = getCurrencySymbol(formData.currency)

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6" />
          <h1 className="text-2xl font-bold">报价计算器</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAiPanelOpen(true)}>
          <Sparkles className="mr-1.5 h-4 w-4 text-blue-500" />
          AI 解析询盘
        </Button>
      </div>

      {/* Exchange Rate */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-blue-600">汇率</span>
            <span className="text-lg font-bold ml-2">
              {formData.currency}/CNY = {exchangeRate.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-500">更新于 {formatTime(rateUpdatedAt)}</span>
            <Button variant="ghost" size="sm" onClick={fetchExchangeRate} disabled={rateLoading}>
              <RefreshCw className={`w-4 h-4 ${rateLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Input Form */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <h2 className="font-bold">输入参数</h2>

            {/* Product Table */}
            <div className="space-y-2">
              <label className="text-sm font-medium">产品列表</label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-500">名称</th>
                      <th className="text-left p-2 font-medium text-gray-500 w-20">型号</th>
                      <th className="text-left p-2 font-medium text-gray-500 w-14">单位</th>
                      <th className="text-right p-2 font-medium text-gray-500 w-24">成本价(¥)*</th>
                      <th className="text-right p-2 font-medium text-gray-500 w-20">数量*</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcProducts.map((row) => (
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
                    ))}
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

            {/* Shared costs */}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">期望利润率 (%) *</label>
                <Input
                  type="number"
                  value={formData.profitRate}
                  onChange={(e) => setFormData({ ...formData, profitRate: e.target.value })}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">目标货币</label>
                <Select value={formData.currency} onValueChange={handleCurrencyChange}>
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
            </div>

            {/* LCL/FCL */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLCLFCL"
                checked={showLCLFCL}
                onChange={(e) => setShowLCLFCL(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="showLCLFCL" className="text-sm font-medium">
                阶梯报价（散货 vs 整柜）
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

        {/* ── Right: Results */}
        <div className="space-y-4">
          <h2 className="font-bold">报价结果</h2>

          {!multiResults ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                请输入产品成本和数量
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Order totals table */}
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-medium text-gray-500">贸易术语</th>
                        <th className="text-right p-3 font-medium text-gray-500">{formData.currency} 合计</th>
                        <th className="text-right p-3 font-medium text-gray-500">CNY 合计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multiResults.orderTotals.map((r) => {
                        const isSelected = r.term === quoteDetails.tradeTerm
                        const isHighlighted = r.term === 'FOB' || r.term === 'CIF'
                        return (
                          <tr
                            key={r.term}
                            onClick={() => setQuoteDetails((prev) => ({ ...prev, tradeTerm: r.term }))}
                            className={`border-b cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50 border-l-2 border-l-blue-500'
                                : isHighlighted
                                ? 'hover:bg-gray-50 text-blue-700 font-medium'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="p-3">
                              <span className="font-mono font-medium">{r.term}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {TRADE_TERMS.find((t) => t.code === r.term)?.desc}
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium">
                              {sym}{formatPrice(r.priceForeign)}
                            </td>
                            <td className="p-3 text-right text-gray-500">
                              ¥{r.priceCNY.toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400 p-3">点击行可选择贸易术语</p>
                </CardContent>
              </Card>

              {/* Product breakdown (≥2 products) */}
              {calcProducts.filter((p) => parseFloat(p.costPrice) > 0).length >= 2 && (
                <Card>
                  <CardContent className="p-3">
                    <button
                      type="button"
                      onClick={() => setShowDetail((v) => !v)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full"
                    >
                      {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      产品明细（{quoteDetails.tradeTerm}）
                    </button>
                    {showDetail && (
                      <div className="mt-3 space-y-2">
                        {multiResults.byProduct.map(({ productId, results }) => {
                          const calc = calcProducts.find((p) => p.id === productId)
                          if (!calc) return null
                          const r = results.find((r) => r.term === quoteDetails.tradeTerm)
                          if (!r) return null
                          const qty = parseFloat(calc.quantity) || 1
                          return (
                            <div key={productId} className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 rounded px-3 py-2">
                              <span className="font-medium">{calc.name || '产品'}{calc.model ? ` (${calc.model})` : ''}</span>
                              <span className="text-gray-500">
                                {sym}{formatPrice(r.priceForeign)}/{calc.unit} × {qty} = <span className="font-semibold text-blue-700">{sym}{(r.priceForeign * qty).toFixed(2)}</span>
                              </span>
                            </div>
                          )
                        })}
                        <div className="flex justify-between text-xs font-bold border-t pt-2 px-3">
                          <span>合计</span>
                          <span className="text-blue-700">
                            {sym}{(multiResults.orderTotals.find((r) => r.term === quoteDetails.tradeTerm)?.priceForeign || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button className="w-full" onClick={openQuoteDialog}>
                <FileText className="mr-2 h-4 w-4" />
                生成报价单
              </Button>
            </>
          )}
        </div>
      </div>

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
            <DialogTitle>{quoteStep === 1 ? '第一步：选择客户' : '第二步：报价单信息'}</DialogTitle>
            <DialogDescription>
              {quoteStep === 1 ? '搜索已有客户，或新建客户' : '填写报价单详情，完成后生成 PDF'}
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

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">客户：</span>
                <span className="font-medium">{selectedCustomer?.company_name || newCustomerData.company_name}</span>
                {lastQuote && (
                  <div className="text-xs text-blue-600 mt-1">
                    上次报价：{new Date(lastQuote.date).toLocaleDateString('zh-CN')}，{lastQuote.trade_term} {lastQuote.currency} {lastQuote.total_amount_foreign.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Trade Term + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">贸易术语</label>
                  <Select value={quoteDetails.tradeTerm} onValueChange={(v) => setQuoteDetails({ ...quoteDetails, tradeTerm: v || quoteDetails.tradeTerm })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(multiResults?.orderTotals || []).map((r) => (
                        <SelectItem key={r.term} value={r.term}>
                          {r.term} — {sym}{formatPrice(r.priceForeign)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">单据类型</label>
                  <Select value={quoteDetails.type} onValueChange={(v) => setQuoteDetails({ ...quoteDetails, type: (v || quoteDetails.type) as 'QUOTATION' | 'PI' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUOTATION">Quotation</SelectItem>
                      <SelectItem value="PI">Proforma Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">产品明细</label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => {
                      const price = selectedTradeResult?.priceForeign || 0
                      setPdfProducts((prev) => [...prev, { name: '', model: '', specs: '', qty: 1, unit: 'pc', unit_price_foreign: price, amount_foreign: price }])
                    }}
                  >
                    + 添加行
                  </button>
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
                      {pdfProducts.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-1">
                            <input
                              className="w-full text-xs border rounded px-1 py-0.5 focus:outline-blue-400"
                              value={row.name}
                              onChange={(e) => { const u = [...pdfProducts]; u[idx] = { ...u[idx], name: e.target.value }; setPdfProducts(u) }}
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
                                const u = [...pdfProducts]; u[idx] = { ...u[idx], qty, amount_foreign: qty * u[idx].unit_price_foreign }; setPdfProducts(u)
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
                                const u = [...pdfProducts]; u[idx] = { ...u[idx], unit_price_foreign: price, amount_foreign: price * u[idx].qty }; setPdfProducts(u)
                              }}
                            />
                          </td>
                          <td className="p-2 text-right font-medium">{sym}{row.amount_foreign.toFixed(2)}</td>
                          <td className="p-1 text-center">
                            {pdfProducts.length > 1 && (
                              <button type="button" className="text-red-400 hover:text-red-600" onClick={() => setPdfProducts((prev) => prev.filter((_, i) => i !== idx))}>×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={3} className="p-2 text-right text-xs font-bold text-gray-600">合计</td>
                        <td className="p-2 text-right text-xs font-bold text-blue-700">{sym}{pdfProducts.reduce((s, p) => s + p.amount_foreign, 0).toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

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

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handlePreviewPDF} disabled={previewing || generating}>
                  {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  预览
                </Button>
                <Button className="flex-1" onClick={handleGeneratePDF} disabled={generating || previewing}>
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  保存并下载
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
