'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calculator, ChevronDown, Loader2, RefreshCw, FileText, Search, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
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
  DialogTrigger,
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

interface Product {
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

interface Customer {
  id: string
  company_name: string
  contact_name?: string
  email?: string
  country?: string
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
}

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
          (unitCost + unitDomestic + unitFreight + unitDestination * 0.7) *
          profitFactor
        break
      case 'DPU':
        priceCNY =
          (unitCost + unitDomestic + unitFreight + unitDestination) * profitFactor
        break
      case 'DDP':
        priceCNY =
          (unitCost + unitDomestic + unitFreight + unitDestination * 1.15) *
          profitFactor
        break
    }

    return {
      term: term.code,
      priceForeign: priceCNY * exchangeRate,
      priceCNY,
    }
  })
}

function calculateDiscount(
  lclFreight: number,
  fclFreight: number,
  lclQty: number
): number {
  if (lclFreight <= 0) return 0
  const lclPrice = (lclFreight / lclQty) * 1.1
  const fclPrice = (fclFreight / lclQty) * 1.1
  if (lclPrice <= 0) return 0
  return ((lclPrice - fclPrice) / lclPrice) * 100
}

export default function QuotePage() {
  // ── Existing state ──────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [exchangeRate, setExchangeRate] = useState(0.14)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateUpdatedAt, setRateUpdatedAt] = useState('')

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    productCost: '',
    quantity: '100',
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

  // ── Quote dialog state ──────────────────────────────────────────
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [quoteStep, setQuoteStep] = useState<1 | 2>(1)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerData, setNewCustomerData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    country: '',
  })
  const [lastQuote, setLastQuote] = useState<{
    date: string
    trade_term: string
    currency: string
    total_amount_foreign: number
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // ── Computed values ─────────────────────────────────────────────
  const results = useMemo(() => {
    const cost = parseFloat(formData.productCost) || 0
    const qty = parseFloat(formData.quantity) || 1
    const domestic = parseFloat(formData.domesticCost) || 0
    const freight = parseFloat(formData.freight) || 0
    const dest = parseFloat(formData.destinationCost) || 0
    const ins = parseFloat(formData.insuranceRate) || 0.3
    const profit = parseFloat(formData.profitRate) || 10

    if (cost <= 0 || qty <= 0) return []

    return calculateQuote(cost, qty, domestic, freight, dest, ins, profit, exchangeRate)
  }, [formData, exchangeRate])

  const discount = useMemo(() => {
    if (!showLCLFCL) return 0
    return calculateDiscount(
      parseFloat(lclData.freight) || 0,
      parseFloat(fclData.freight) || 0,
      parseFloat(lclData.quantity) || 500
    )
  }, [showLCLFCL, lclData, fclData])

  const selectedTradeResult = useMemo(
    () => results.find((r) => r.term === quoteDetails.tradeTerm) || null,
    [results, quoteDetails.tradeTerm]
  )

  // ── Effects ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchProducts()
    fetchExchangeRate()
  }, [])

  // Search customers with debounce
  useEffect(() => {
    if (!customerQuery.trim()) {
      setCustomerResults([])
      return
    }
    const timer = setTimeout(async () => {
      setCustomerLoading(true)
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(customerQuery)}&limit=8`
        )
        const data = await res.json()
        setCustomerResults(data.customers || [])
      } catch {
        // ignore
      } finally {
        setCustomerLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerQuery])

  // Auto-add ocean freight remark for CIF/CFR terms
  useEffect(() => {
    const oceanNote =
      'Ocean freight is subject to actual rate at time of shipment.'
    const isCIF = ['CIF', 'CIP', 'CFR', 'CPT'].includes(quoteDetails.tradeTerm)
    setQuoteDetails((prev) => {
      const hasNote = prev.remarks.includes(oceanNote)
      if (isCIF && !hasNote) {
        return {
          ...prev,
          remarks: prev.remarks ? `${prev.remarks}\n${oceanNote}` : oceanNote,
        }
      }
      if (!isCIF && hasNote) {
        return {
          ...prev,
          remarks: prev.remarks
            .replace(`\n${oceanNote}`, '')
            .replace(oceanNote, '')
            .trim(),
        }
      }
      return prev
    })
  }, [quoteDetails.tradeTerm])

  // ── Existing functions ──────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100')
      const data = await res.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error:', error)
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
      setExchangeRate(data.rate || 0.14)
      setRateUpdatedAt(data.updatedAt || '')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setRateLoading(false)
    }
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setFormData({ ...formData, productCost: String(product.cost_price) })
    setProductDialogOpen(false)
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
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setRateLoading(false)
    }
  }

  const formatTime = (isoString: string) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
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

  // ── Quote dialog functions ──────────────────────────────────────
  const openQuoteDialog = async () => {
    // Reset dialog state
    setQuoteStep(1)
    setSelectedCustomer(null)
    setIsNewCustomer(false)
    setCustomerQuery('')
    setCustomerResults([])
    setLastQuote(null)
    setNewCustomerData({ company_name: '', contact_name: '', email: '', phone: '', country: '' })

    // Load user profile for defaults
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
    } catch {
      // continue with defaults
    }

    setQuoteDialogOpen(true)
  }

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsNewCustomer(false)
    setCustomerQuery(customer.company_name)
    setCustomerResults([])

    // Fetch last quotation for this customer
    try {
      const res = await fetch(`/api/customers/${customer.id}`)
      const data = await res.json()
      if (data.quotations?.length > 0) {
        const q = data.quotations[0]
        setLastQuote({
          date: q.created_at,
          trade_term: q.trade_term,
          currency: q.currency,
          total_amount_foreign: q.total_amount_foreign,
        })
      } else {
        setLastQuote(null)
      }
    } catch {
      setLastQuote(null)
    }
  }

  const handleGeneratePDF = async () => {
    if (!selectedCustomer && !isNewCustomer) {
      toast.error('请选择或新建客户')
      return
    }
    if (isNewCustomer && !newCustomerData.company_name.trim()) {
      toast.error('请填写客户公司名称')
      return
    }
    if (!selectedTradeResult) {
      toast.error('请先填写成本信息并计算报价')
      return
    }

    setGenerating(true)
    try {
      let customerId = selectedCustomer?.id
      let customerName = selectedCustomer?.company_name || ''
      let customerContact = selectedCustomer?.contact_name || ''

      // Create new customer if needed
      if (isNewCustomer) {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCustomerData),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '创建客户失败')
        customerId = data.id
        customerName = data.company_name
        customerContact = data.contact_name || ''
      }

      const qty = parseFloat(formData.quantity) || 1
      const unitPriceForeign = selectedTradeResult.priceForeign
      const amountForeign = unitPriceForeign * qty
      const amountCNY = selectedTradeResult.priceCNY * qty

      const productForDB = {
        name: selectedProduct?.name || '产品',
        model: selectedProduct?.model || undefined,
        qty,
        unit: selectedProduct?.unit || 'pc',
        cost_price: parseFloat(formData.productCost) || 0,
        unit_price_foreign: unitPriceForeign,
        amount_foreign: amountForeign,
      }

      // Save quotation to DB first to get the auto-generated number
      const saveRes = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          trade_term: quoteDetails.tradeTerm,
          currency: formData.currency,
          exchange_rate: exchangeRate,
          products: [productForDB],
          costs: {
            domestic_cost: parseFloat(formData.domesticCost) || 0,
            freight: parseFloat(formData.freight) || 0,
            destination_cost: parseFloat(formData.destinationCost) || 0,
            insurance_rate: parseFloat(formData.insuranceRate) || 0.3,
            profit_rate: parseFloat(formData.profitRate) || 10,
          },
          total_amount_foreign: amountForeign,
          total_amount_cny: amountCNY,
          payment_terms: quoteDetails.paymentTerms,
          delivery_time: quoteDetails.deliveryTime,
          validity_days: quoteDetails.validityDays,
          packing: quoteDetails.packing,
          remarks: quoteDetails.remarks,
        }),
      })

      const savedQuote = await saveRes.json()
      if (!saveRes.ok) throw new Error(savedQuote.error || '保存报价失败')

      // Update existing customer status to 'quoted'
      if (selectedCustomer) {
        await fetch(`/api/customers/${customerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...selectedCustomer, status: 'quoted' }),
        })
      }

      // Generate PDF using dynamic import to avoid SSR issues
      const React = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { QuotationPDF } = await import('@/components/pdf/QuotationPDF')

      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const element = React.createElement(QuotationPDF, {
        companyName: userProfile?.company_name || 'Your Company',
        companyNameCn: userProfile?.company_name_cn,
        address: userProfile?.address,
        phone: userProfile?.phone,
        email: userProfile?.email,
        website: userProfile?.website,
        logoUrl: userProfile?.logo_url,
        clientName: customerName,
        clientContact: customerContact || undefined,
        quotationNumber: savedQuote.quotation_number,
        date: today,
        validityDays: quoteDetails.validityDays,
        tradeTerm: quoteDetails.tradeTerm,
        currency: formData.currency,
        products: [
          {
            name: selectedProduct?.name || '产品',
            model: selectedProduct?.model || undefined,
            specs: selectedProduct?.specs || undefined,
            qty,
            unit: selectedProduct?.unit || 'pc',
            unit_price_foreign: unitPriceForeign,
            amount_foreign: amountForeign,
          },
        ],
        totalAmount: amountForeign,
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
    } catch (error: any) {
      toast.error(error.message || '生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6" />
          <h1 className="text-2xl font-bold">报价计算器</h1>
        </div>
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
            <span className="text-xs text-blue-500">
              更新于 {formatTime(rateUpdatedAt)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchExchangeRate}
              disabled={rateLoading}
            >
              <RefreshCw className={`w-4 h-4 ${rateLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-bold mb-4">输入参数</h2>

            {/* Product Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">选择产品（可选）</label>
              <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedProduct ? selectedProduct.name : '从产品库选择...'}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>选择产品</DialogTitle>
                    <DialogDescription>选择产品后自动填充成本价</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[300px] overflow-y-auto">
                    {products.length === 0 ? (
                      <p className="text-center py-4 text-gray-500">
                        暂无产品，请先添加产品
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {products.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleProductSelect(p)}
                            className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                          >
                            <div className="font-medium">{p.name}</div>
                            <div className="text-sm text-gray-500">
                              ¥{p.cost_price} {p.model && `- ${p.model}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Basic Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">产品成本 (CNY) *</label>
                <Input
                  type="number"
                  value={formData.productCost}
                  onChange={(e) =>
                    setFormData({ ...formData, productCost: e.target.value })
                  }
                  placeholder="工厂出厂价"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">数量 *</label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  placeholder="数量"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">国内费用 (CNY)</label>
                <Input
                  type="number"
                  value={formData.domesticCost}
                  onChange={(e) =>
                    setFormData({ ...formData, domesticCost: e.target.value })
                  }
                  placeholder="拖车费+港杂费"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">海运费 (CNY)</label>
                <Input
                  type="number"
                  value={formData.freight}
                  onChange={(e) =>
                    setFormData({ ...formData, freight: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, destinationCost: e.target.value })
                  }
                  placeholder="DAP/DPU/DDP用"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">保险费率 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.insuranceRate}
                  onChange={(e) =>
                    setFormData({ ...formData, insuranceRate: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, profitRate: e.target.value })
                  }
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
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* LCL/FCL Toggle */}
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
                    <Input
                      type="number"
                      value={lclData.quantity}
                      onChange={(e) =>
                        setLclData({ ...lclData, quantity: e.target.value })
                      }
                      placeholder="500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">散货海运费</label>
                    <Input
                      type="number"
                      value={lclData.freight}
                      onChange={(e) =>
                        setLclData({ ...lclData, freight: e.target.value })
                      }
                      placeholder="800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">整柜数量</label>
                    <Input
                      type="number"
                      value={fclData.quantity}
                      onChange={(e) =>
                        setFclData({ ...fclData, quantity: e.target.value })
                      }
                      placeholder="2000"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">整柜海运费</label>
                    <Input
                      type="number"
                      value={fclData.freight}
                      onChange={(e) =>
                        setFclData({ ...fclData, freight: e.target.value })
                      }
                      placeholder="1500"
                    />
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

        {/* Results */}
        <div className="space-y-4">
          <h2 className="font-bold">报价结果</h2>

          {results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                请输入产品成本和数量
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {results.map((result) => (
                <Card
                  key={result.term}
                  className={
                    result.term === 'FOB' || result.term === 'CIF'
                      ? 'border-blue-500 bg-blue-50'
                      : ''
                  }
                >
                  <CardContent className="p-4">
                    <div className="text-xs text-gray-500 mb-1">
                      {TRADE_TERMS.find((t) => t.code === result.term)?.desc}
                    </div>
                    <div className="text-lg font-bold">
                      {getCurrencySymbol(formData.currency)}
                      {formatPrice(result.priceForeign)}
                    </div>
                    <div className="text-xs text-gray-500">
                      ¥{formatPrice(result.priceCNY)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <Button className="w-full" onClick={openQuoteDialog}>
              <FileText className="mr-2 h-4 w-4" />
              生成报价单
            </Button>
          )}
        </div>
      </div>

      {/* ── Quote Generation Dialog ─────────────────────────────── */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {quoteStep === 1 ? '第一步：选择客户' : '第二步：报价单信息'}
            </DialogTitle>
            <DialogDescription>
              {quoteStep === 1
                ? '搜索已有客户，或新建客户'
                : '填写报价单详情，完成后生成 PDF'}
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
                      onChange={(e) => {
                        setCustomerQuery(e.target.value)
                        setSelectedCustomer(null)
                      }}
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
                          className={`p-3 cursor-pointer hover:bg-gray-50 ${
                            selectedCustomer?.id === c.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="font-medium text-sm">{c.company_name}</div>
                          {c.contact_name && (
                            <div className="text-xs text-gray-500">{c.contact_name}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="font-medium text-sm text-blue-800">
                        已选择：{selectedCustomer.company_name}
                      </div>
                      {lastQuote && (
                        <div className="text-xs text-blue-600 mt-1">
                          上次报价：
                          {new Date(lastQuote.date).toLocaleDateString('zh-CN')}，
                          {lastQuote.trade_term}，{lastQuote.currency}{' '}
                          {lastQuote.total_amount_foreign.toFixed(2)}
                        </div>
                      )}
                      {!lastQuote && (
                        <div className="text-xs text-blue-500 mt-1">暂无历史报价</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="flex-1 border-t" />
                    <span>或</span>
                    <div className="flex-1 border-t" />
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsNewCustomer(true)}
                  >
                    + 新建客户
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 -mb-2"
                    onClick={() => setIsNewCustomer(false)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回搜索
                  </Button>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">公司名称 *</label>
                      <Input
                        className="mt-1"
                        value={newCustomerData.company_name}
                        onChange={(e) =>
                          setNewCustomerData({ ...newCustomerData, company_name: e.target.value })
                        }
                        placeholder="客户公司名称"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">联系人</label>
                        <Input
                          className="mt-1"
                          value={newCustomerData.contact_name}
                          onChange={(e) =>
                            setNewCustomerData({ ...newCustomerData, contact_name: e.target.value })
                          }
                          placeholder="联系人姓名"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">国家</label>
                        <Input
                          className="mt-1"
                          value={newCustomerData.country}
                          onChange={(e) =>
                            setNewCustomerData({ ...newCustomerData, country: e.target.value })
                          }
                          placeholder="如 USA"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">邮箱</label>
                        <Input
                          className="mt-1"
                          type="email"
                          value={newCustomerData.email}
                          onChange={(e) =>
                            setNewCustomerData({ ...newCustomerData, email: e.target.value })
                          }
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">电话</label>
                        <Input
                          className="mt-1"
                          value={newCustomerData.phone}
                          onChange={(e) =>
                            setNewCustomerData({ ...newCustomerData, phone: e.target.value })
                          }
                          placeholder="WhatsApp 等"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Button
                className="w-full"
                disabled={
                  (!selectedCustomer && !isNewCustomer) ||
                  (isNewCustomer && !newCustomerData.company_name.trim())
                }
                onClick={() => setQuoteStep(2)}
              >
                下一步
              </Button>
            </div>
          )}

          {/* Step 2: Quote Details */}
          {quoteStep === 2 && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 -mb-2"
                onClick={() => setQuoteStep(1)}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回选择客户
              </Button>

              {/* Customer reminder */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">客户：</span>
                <span className="font-medium">
                  {selectedCustomer?.company_name || newCustomerData.company_name}
                </span>
                {lastQuote && (
                  <div className="text-xs text-blue-600 mt-1">
                    上次报价：{new Date(lastQuote.date).toLocaleDateString('zh-CN')}，
                    {lastQuote.trade_term} {lastQuote.currency}{' '}
                    {lastQuote.total_amount_foreign.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Trade Term + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">贸易术语</label>
                  <Select
                    value={quoteDetails.tradeTerm}
                    onValueChange={(v) =>
                      setQuoteDetails({ ...quoteDetails, tradeTerm: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {results.map((r) => (
                        <SelectItem key={r.term} value={r.term}>
                          {r.term} — {getCurrencySymbol(formData.currency)}
                          {formatPrice(r.priceForeign)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">单据类型</label>
                  <Select
                    value={quoteDetails.type}
                    onValueChange={(v) =>
                      setQuoteDetails({
                        ...quoteDetails,
                        type: v as 'QUOTATION' | 'PI',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUOTATION">Quotation</SelectItem>
                      <SelectItem value="PI">Proforma Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Total preview */}
              {selectedTradeResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">
                      {quoteDetails.tradeTerm} 单价：
                    </span>
                    <span className="font-bold text-blue-800">
                      {getCurrencySymbol(formData.currency)}
                      {formatPrice(selectedTradeResult.priceForeign)} /{' '}
                      {selectedProduct?.unit || 'pc'}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-blue-600">
                      总额（×{formData.quantity}）：
                    </span>
                    <span className="font-bold text-blue-800">
                      {getCurrencySymbol(formData.currency)}
                      {(
                        selectedTradeResult.priceForeign *
                        (parseFloat(formData.quantity) || 1)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Terms */}
              <div className="space-y-2">
                <label className="text-sm font-medium">付款条件</label>
                <Select
                  value={quoteDetails.paymentTerms}
                  onValueChange={(v) =>
                    setQuoteDetails({ ...quoteDetails, paymentTerms: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery + Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">交货期</label>
                  <Input
                    value={quoteDetails.deliveryTime}
                    onChange={(e) =>
                      setQuoteDetails({ ...quoteDetails, deliveryTime: e.target.value })
                    }
                    placeholder="如 30 days after deposit"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">有效期（天）</label>
                  <Input
                    type="number"
                    value={quoteDetails.validityDays}
                    onChange={(e) =>
                      setQuoteDetails({
                        ...quoteDetails,
                        validityDays: parseInt(e.target.value) || 30,
                      })
                    }
                    placeholder="30"
                  />
                </div>
              </div>

              {/* Packing */}
              <div className="space-y-2">
                <label className="text-sm font-medium">包装方式</label>
                <Input
                  value={quoteDetails.packing}
                  onChange={(e) =>
                    setQuoteDetails({ ...quoteDetails, packing: e.target.value })
                  }
                  placeholder="如 Standard export carton"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <label className="text-sm font-medium">备注</label>
                <Textarea
                  value={quoteDetails.remarks}
                  onChange={(e) =>
                    setQuoteDetails({ ...quoteDetails, remarks: e.target.value })
                  }
                  placeholder="其他说明..."
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleGeneratePDF}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    生成并下载 PDF
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
