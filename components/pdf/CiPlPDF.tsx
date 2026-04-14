/**
 * CiPlPDF — Commercial Invoice (CI) and Packing List (PL) PDF
 *
 * Layout: A4 Landscape (wider, to fit all customs columns).
 * Mode 'CI' renders price columns; mode 'PL' omits them.
 */
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import { amountInWordsEn } from '@/lib/amountInWords'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CiPlProduct {
  /** True for section-header rows (container / lot dividers) */
  is_container_header?: boolean
  name: string
  model?: string
  hs_code?: string
  size?: string
  material?: string
  country_of_origin?: string
  qty: number
  unit: string
  no_of_packages?: number
  cbm?: number
  nw?: number
  gw?: number
  /** CI mode only */
  unit_price_foreign?: number
  amount_foreign?: number
}

export interface CiPlPDFProps {
  mode: 'CI' | 'PL'
  // Company / seller
  companyName: string
  companyNameCn?: string
  address?: string
  phone?: string
  email?: string
  logoUrl?: string
  // Bank info — shown at bottom of CI
  bankName?: string
  bankAccount?: string
  bankSwift?: string
  bankBeneficiary?: string
  bankAddress?: string
  // Buyer / ship-to
  clientName: string
  clientContact?: string
  clientAddress?: string
  clientPhone?: string
  // Document header
  documentNumber: string
  date: string
  currency: string
  tradeTerm?: string
  paymentTerms?: string
  // Shipment info
  portOfLoading?: string
  portOfDischarge?: string
  vesselVoyage?: string
  containerNumber?: string
  sealNumber?: string
  // Products
  products: CiPlProduct[]
  // Pre-computed totals (if not provided, computed from products)
  totalAmount?: number
  totalPackages?: number
  totalCbm?: number
  totalNw?: number
  totalGw?: number
  // Remarks / notes
  remarks?: string
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#111',
  },
  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  logo: {
    width: 64,
    height: 40,
    objectFit: 'contain',
  },
  companyBlock: {
    flex: 1,
  },
  companyName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  companyInfo: {
    fontSize: 7.5,
    color: '#555',
    marginBottom: 1,
  },
  docTitleBlock: {
    alignItems: 'flex-end',
    minWidth: 180,
  },
  docTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  docNo: {
    fontSize: 9,
    color: '#333',
    marginTop: 4,
  },
  // ── Info grid ──
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 6,
  },
  infoCol: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    width: 90,
    fontSize: 7.5,
    color: '#555',
    fontFamily: 'Helvetica-Bold',
  },
  infoValue: {
    flex: 1,
    fontSize: 7.5,
  },
  // ── Table ──
  table: {
    marginBottom: 8,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  th: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#fff',
    textAlign: 'center',
  },
  tbody: {},
  tr: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  trAlt: {
    backgroundColor: '#f7f9fc',
  },
  trHeader: {
    backgroundColor: '#e8edf5',
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#bbb',
  },
  td: {
    fontSize: 7,
    textAlign: 'center',
  },
  tdLeft: {
    fontSize: 7,
    textAlign: 'left',
  },
  tdRight: {
    fontSize: 7,
    textAlign: 'right',
  },
  // totals row
  totalsTr: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#f0f4fb',
  },
  totalsTd: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  // ── Bottom sections ──
  amountWords: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    padding: 5,
    backgroundColor: '#f5f5f5',
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  bankBlock: {
    marginBottom: 8,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#bbb',
  },
  bankTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bankRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bankLabel: {
    width: 100,
    fontSize: 7.5,
    color: '#555',
  },
  bankValue: {
    flex: 1,
    fontSize: 7.5,
  },
  remarksBlock: {
    marginBottom: 8,
    padding: 5,
    backgroundColor: '#fffdf0',
    borderWidth: 0.5,
    borderColor: '#ddd',
  },
  remarksTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  remarksText: {
    fontSize: 7.5,
    color: '#333',
  },
  signRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 20,
  },
  signBlock: {
    flex: 1,
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#666',
    marginBottom: 3,
    height: 24,
  },
  signLabel: {
    fontSize: 7.5,
    color: '#555',
    textAlign: 'center',
  },
})

// ─── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  key: string
  label: string
  width: number
  align: 'left' | 'center' | 'right'
}

function getCols(mode: 'CI' | 'PL'): ColDef[] {
  const base: ColDef[] = [
    { key: 'sn',       label: 'S/N',          width: 22,  align: 'center' },
    { key: 'model',    label: 'ITEM CODE',     width: 58,  align: 'left'   },
    { key: 'hs',       label: 'HS CODE',       width: 55,  align: 'center' },
    { key: 'size',     label: 'SIZE/CM',       width: 52,  align: 'center' },
    { key: 'desc',     label: 'DESCRIPTION',   width: 115, align: 'left'   },
    { key: 'material', label: 'MATERIAL',      width: 55,  align: 'left'   },
    { key: 'co',       label: 'C/O',           width: 38,  align: 'center' },
    { key: 'qty',      label: 'QTY',           width: 36,  align: 'center' },
    { key: 'pkgs',     label: 'PKGS',          width: 30,  align: 'center' },
    { key: 'cbm',      label: "T'CBM",         width: 38,  align: 'center' },
    { key: 'nw',       label: "T'N.W(KG)",     width: 42,  align: 'center' },
    { key: 'gw',       label: "T'G.W(KG)",     width: 42,  align: 'center' },
  ]
  if (mode === 'CI') {
    base.push(
      { key: 'price',  label: 'UNIT PRICE',    width: 52,  align: 'right'  },
      { key: 'amount', label: 'AMOUNT',         width: 52,  align: 'right'  }
    )
  }
  return base
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined, decimals = 2) {
  if (n == null || n === 0) return ''
  return n.toFixed(decimals)
}

function fmtPrice(n: number | undefined, sym: string, decimals = 2) {
  if (n == null || n === 0) return ''
  return `${sym}${n.toFixed(decimals)}`
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', AUD: 'A$', CAD: 'C$',
}
function sym(currency: string) {
  return CURRENCY_SYMBOLS[currency] ?? currency + ' '
}

// ─── Cell renderer ─────────────────────────────────────────────────────────────

function Cell({
  col,
  children,
  style,
}: {
  col: ColDef
  children?: React.ReactNode
  style?: Record<string, unknown>
}) {
  const base =
    col.align === 'left'
      ? S.tdLeft
      : col.align === 'right'
      ? S.tdRight
      : S.td
  const styles: Record<string, unknown>[] = [base as Record<string, unknown>, { width: col.width }]
  if (style) styles.push(style)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Text style={styles as any}>{children ?? ''}</Text>
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CiPlPDF(props: CiPlPDFProps) {
  const {
    mode,
    companyName,
    companyNameCn,
    address,
    phone,
    email,
    logoUrl,
    bankName,
    bankAccount,
    bankSwift,
    bankBeneficiary,
    bankAddress,
    clientName,
    clientContact,
    clientAddress,
    clientPhone,
    documentNumber,
    date,
    currency,
    tradeTerm,
    paymentTerms,
    portOfLoading,
    portOfDischarge,
    vesselVoyage,
    containerNumber,
    sealNumber,
    products,
    totalAmount: totalAmountProp,
    totalPackages: totalPackagesProp,
    totalCbm: totalCbmProp,
    totalNw: totalNwProp,
    totalGw: totalGwProp,
    remarks,
  } = props

  const cols = getCols(mode)
  const s = sym(currency)

  // Compute totals from products if not provided
  const dataRows = products.filter((p) => !p.is_container_header)
  const totalQty = dataRows.reduce((acc, p) => acc + (p.qty || 0), 0)
  const totalPkgs = totalPackagesProp ?? dataRows.reduce((acc, p) => acc + (p.no_of_packages || 0), 0)
  const totalCbm = totalCbmProp ?? dataRows.reduce((acc, p) => acc + (p.cbm || 0), 0)
  const totalNw = totalNwProp ?? dataRows.reduce((acc, p) => acc + (p.nw || 0), 0)
  const totalGw = totalGwProp ?? dataRows.reduce((acc, p) => acc + (p.gw || 0), 0)
  const totalAmount = totalAmountProp ?? dataRows.reduce((acc, p) => acc + (p.amount_foreign || 0), 0)

  let rowIndex = 0

  function renderProductRow(p: CiPlProduct, idx: number) {
    if (p.is_container_header) {
      return (
        <View key={idx} style={S.trHeader}>
          {cols.map((col) => (
            <Text key={col.key} style={[S.td, { width: col.width, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>
              {col.key === 'sn' ? '' : col.key === 'desc' || col.key === 'model' ? p.name : ''}
            </Text>
          ))}
        </View>
      )
    }
    rowIndex++
    const isAlt = rowIndex % 2 === 0
    return (
      <View key={idx} style={[S.tr, isAlt ? S.trAlt : {}]}>
        {cols.map((col) => {
          switch (col.key) {
            case 'sn':      return <Cell key={col.key} col={col}>{String(rowIndex)}</Cell>
            case 'model':   return <Cell key={col.key} col={col}>{p.model || ''}</Cell>
            case 'hs':      return <Cell key={col.key} col={col}>{p.hs_code || ''}</Cell>
            case 'size':    return <Cell key={col.key} col={col}>{p.size || ''}</Cell>
            case 'desc':    return <Cell key={col.key} col={col}>{p.name}</Cell>
            case 'material':return <Cell key={col.key} col={col}>{p.material || ''}</Cell>
            case 'co':      return <Cell key={col.key} col={col}>{p.country_of_origin || ''}</Cell>
            case 'qty':     return <Cell key={col.key} col={col}>{p.qty ? `${p.qty} ${p.unit}` : ''}</Cell>
            case 'pkgs':    return <Cell key={col.key} col={col}>{p.no_of_packages ? String(p.no_of_packages) : ''}</Cell>
            case 'cbm':     return <Cell key={col.key} col={col}>{fmt(p.cbm, 3)}</Cell>
            case 'nw':      return <Cell key={col.key} col={col}>{fmt(p.nw, 2)}</Cell>
            case 'gw':      return <Cell key={col.key} col={col}>{fmt(p.gw, 2)}</Cell>
            case 'price':   return <Cell key={col.key} col={col}>{fmtPrice(p.unit_price_foreign, s)}</Cell>
            case 'amount':  return <Cell key={col.key} col={col}>{fmtPrice(p.amount_foreign, s)}</Cell>
            default:        return <Cell key={col.key} col={col} />
          }
        })}
      </View>
    )
  }

  const hasBankInfo = !!(bankName || bankAccount || bankSwift || bankBeneficiary)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* ── Company Header ── */}
        <View style={S.headerRow}>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoUrl} style={S.logo} />
          ) : null}
          <View style={S.companyBlock}>
            <Text style={S.companyName}>{companyName}{companyNameCn ? ` (${companyNameCn})` : ''}</Text>
            {address    ? <Text style={S.companyInfo}>{address}</Text>    : null}
            {phone      ? <Text style={S.companyInfo}>Tel: {phone}</Text>  : null}
            {email      ? <Text style={S.companyInfo}>Email: {email}</Text>: null}
          </View>
          <View style={S.docTitleBlock}>
            <Text style={S.docTitle}>{mode === 'CI' ? 'Commercial Invoice' : 'Packing List'}</Text>
            <Text style={S.docNo}>No. {documentNumber}</Text>
            <Text style={S.docNo}>Date: {date}</Text>
          </View>
        </View>

        {/* ── Info Grid ── */}
        <View style={S.infoGrid}>
          {/* Left: buyer */}
          <View style={S.infoCol}>
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>TO:</Text>
              <Text style={S.infoValue}>{clientName}</Text>
            </View>
            {clientContact ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>ATTN:</Text>
                <Text style={S.infoValue}>{clientContact}</Text>
              </View>
            ) : null}
            {clientPhone ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>TEL:</Text>
                <Text style={S.infoValue}>{clientPhone}</Text>
              </View>
            ) : null}
            {clientAddress ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>ADDRESS:</Text>
                <Text style={S.infoValue}>{clientAddress}</Text>
              </View>
            ) : null}
          </View>

          {/* Middle: shipment */}
          <View style={S.infoCol}>
            {portOfLoading ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>PORT OF LOADING:</Text>
                <Text style={S.infoValue}>{portOfLoading}</Text>
              </View>
            ) : null}
            {portOfDischarge ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>PORT OF DISCHARGE:</Text>
                <Text style={S.infoValue}>{portOfDischarge}</Text>
              </View>
            ) : null}
            {vesselVoyage ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>VESSEL/VOYAGE:</Text>
                <Text style={S.infoValue}>{vesselVoyage}</Text>
              </View>
            ) : null}
            {containerNumber ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>CONTAINER NO.:</Text>
                <Text style={S.infoValue}>{containerNumber}</Text>
              </View>
            ) : null}
            {sealNumber ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>SEAL NO.:</Text>
                <Text style={S.infoValue}>{sealNumber}</Text>
              </View>
            ) : null}
          </View>

          {/* Right: trade terms */}
          <View style={S.infoCol}>
            {tradeTerm ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>TRADE TERM:</Text>
                <Text style={S.infoValue}>{tradeTerm}</Text>
              </View>
            ) : null}
            {mode === 'CI' && paymentTerms ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>PAYMENT TERMS:</Text>
                <Text style={S.infoValue}>{paymentTerms}</Text>
              </View>
            ) : null}
            {mode === 'CI' ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>CURRENCY:</Text>
                <Text style={S.infoValue}>{currency}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Product Table ── */}
        <View style={S.table}>
          {/* Header */}
          <View style={S.thead}>
            {cols.map((col) => (
              <Text key={col.key} style={[S.th, { width: col.width }]}>
                {col.label}
              </Text>
            ))}
          </View>

          {/* Body */}
          <View style={S.tbody}>
            {products.map((p, idx) => renderProductRow(p, idx))}
          </View>

          {/* Totals row */}
          <View style={S.totalsTr}>
            {cols.map((col) => {
              let v = ''
              switch (col.key) {
                case 'sn':     v = 'TOTAL'; break
                case 'qty':    v = totalQty > 0 ? String(totalQty) : ''; break
                case 'pkgs':   v = totalPkgs > 0 ? String(totalPkgs) : ''; break
                case 'cbm':    v = totalCbm > 0 ? totalCbm.toFixed(3) : ''; break
                case 'nw':     v = totalNw > 0 ? totalNw.toFixed(2) : ''; break
                case 'gw':     v = totalGw > 0 ? totalGw.toFixed(2) : ''; break
                case 'amount': v = totalAmount > 0 ? `${s}${totalAmount.toFixed(2)}` : ''; break
              }
              return (
                <Text
                  key={col.key}
                  style={[
                    S.totalsTd,
                    { width: col.width },
                    col.align === 'right' ? { textAlign: 'right' } : {},
                  ]}
                >
                  {v}
                </Text>
              )
            })}
          </View>
        </View>

        {/* ── Amount in words (CI only) ── */}
        {mode === 'CI' && totalAmount > 0 ? (
          <Text style={S.amountWords}>
            {amountInWordsEn(totalAmount, currency)}
          </Text>
        ) : null}

        {/* ── Bottom row: bank info + remarks ── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Bank details (CI only) */}
          {mode === 'CI' && hasBankInfo ? (
            <View style={[S.bankBlock, { flex: 1 }]}>
              <Text style={S.bankTitle}>Seller's Bank Details</Text>
              {bankBeneficiary ? (
                <View style={S.bankRow}>
                  <Text style={S.bankLabel}>Beneficiary:</Text>
                  <Text style={S.bankValue}>{bankBeneficiary}</Text>
                </View>
              ) : null}
              {bankName ? (
                <View style={S.bankRow}>
                  <Text style={S.bankLabel}>Bank Name:</Text>
                  <Text style={S.bankValue}>{bankName}</Text>
                </View>
              ) : null}
              {bankAddress ? (
                <View style={S.bankRow}>
                  <Text style={S.bankLabel}>Bank Address:</Text>
                  <Text style={S.bankValue}>{bankAddress}</Text>
                </View>
              ) : null}
              {bankSwift ? (
                <View style={S.bankRow}>
                  <Text style={S.bankLabel}>SWIFT Code:</Text>
                  <Text style={S.bankValue}>{bankSwift}</Text>
                </View>
              ) : null}
              {bankAccount ? (
                <View style={S.bankRow}>
                  <Text style={S.bankLabel}>Account No.:</Text>
                  <Text style={S.bankValue}>{bankAccount}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Remarks */}
          {remarks ? (
            <View style={[S.remarksBlock, { flex: 1 }]}>
              <Text style={S.remarksTitle}>REMARKS:</Text>
              <Text style={S.remarksText}>{remarks}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Signature line (CI only) ── */}
        {mode === 'CI' ? (
          <View style={S.signRow}>
            <View style={S.signBlock}>
              <View style={S.signLine} />
              <Text style={S.signLabel}>THE BUYER</Text>
            </View>
            <View style={S.signBlock}>
              <View style={S.signLine} />
              <Text style={S.signLabel}>THE SELLER</Text>
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  )
}
