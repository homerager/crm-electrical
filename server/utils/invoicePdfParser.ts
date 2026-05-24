// Heuristic PDF invoice parser. Extracts text via pdf-parse and tries to find:
//   - invoice number
//   - date
//   - contractor name (best-effort matched to existing contractors)
//   - items table rows -> { rawName, quantity, pricePerUnit, unit }
//     items are matched to existing products by name / sku (best-effort)
// All fields are optional in the result; UI lets the user fix anything missing.

import { PDFParse } from 'pdf-parse'
import { prisma } from './prisma'

export interface ParsedInvoiceItem {
  rawName: string
  productId?: string
  matchedSku?: string
  matchedName?: string
  unit?: string
  quantity: number
  pricePerUnit: number
  vatPercent?: number
}

export interface ParsedInvoice {
  number?: string
  date?: string // yyyy-mm-dd
  contractorId?: string
  contractorName?: string
  notes?: string
  items: ParsedInvoiceItem[]
  rawText: string
  warnings: string[]
}

function normalize(str: string) {
  return str.replace(/\s+/g, ' ').trim().toLowerCase()
}

function parseUkNumber(value: string): number | null {
  if (!value) return null
  // 1 234,56 -> 1234.56 ; 1.234,56 -> 1234.56 ; 1234.56 stays
  let s = value.replace(/\s+/g, '')
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function extractNumber(text: string): string | undefined {
  // Common Ukrainian invoice number labels
  const patterns = [
    /(?:Накладна|Видаткова накладна|Прибуткова накладна|Рахунок(?:[- ]фактура)?|Invoice)\s*(?:№|#|N|No\.?)\s*([A-Za-zА-Яа-яЁё0-9\/\-\._]+)/iu,
    /№\s*([A-Za-zА-Яа-яЁё0-9\/\-\._]+)/u,
    /\bNo\.?\s*([A-Za-zА-Яа-яЁё0-9\/\-\._]+)/iu,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m && m[1]) return m[1].trim()
  }
  return undefined
}

function extractDate(text: string): string | undefined {
  // DD.MM.YYYY or DD/MM/YYYY or YYYY-MM-DD
  const re1 = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/
  const re2 = /\b(\d{4})-(\d{2})-(\d{2})\b/
  const m1 = text.match(re1)
  if (m1) {
    let [_, d, mo, y] = m1
    if (y.length === 2) y = '20' + y
    const dd = d.padStart(2, '0')
    const mm = mo.padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }
  const m2 = text.match(re2)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  return undefined
}

// Detect rows of the form: <idx> <name...> <qty> <price> <sum>
// numbers can be Ukrainian (1 234,56) or English (1234.56)
const NUM = '[\\d\\s.,]+'
const ITEM_LINE = new RegExp(
  `^\\s*(\\d{1,3})[.)\\s]+(.+?)\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s*$`,
  'u',
)

function looksLikeHeader(line: string) {
  const l = normalize(line)
  return (
    l.includes('найменування') ||
    l.includes('товар') ||
    (l.includes('ціна') && l.includes('сума')) ||
    l.includes('кількість') ||
    l.includes('к-сть')
  )
}

function isTotalsLine(line: string) {
  const l = normalize(line)
  return (
    l.startsWith('всього') ||
    l.startsWith('разом') ||
    l.startsWith('усього') ||
    l.startsWith('пдв') ||
    l.includes('до сплати') ||
    l.includes('сума без пдв') ||
    l.includes('сума з пдв')
  )
}

function extractItems(text: string): ParsedInvoiceItem[] {
  const items: ParsedInvoiceItem[] = []
  const lines = text.split(/\r?\n/)
  let started = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (!started && looksLikeHeader(line)) {
      started = true
      continue
    }

    if (isTotalsLine(line)) {
      // if we hit totals before any items, stop trying
      if (items.length > 0) break
      continue
    }

    const m = line.match(ITEM_LINE)
    if (!m) continue

    const [, , nameRaw, qtyStr, priceStr, sumStr] = m
    const qty = parseUkNumber(qtyStr)
    const price = parseUkNumber(priceStr)
    const sum = parseUkNumber(sumStr)
    if (qty == null || price == null) continue
    // sanity: qty*price should be close to sum (within 5%) when sum present
    if (sum != null && qty * price > 0) {
      const expected = qty * price
      const diff = Math.abs(expected - sum) / Math.max(expected, sum, 1)
      if (diff > 0.1) continue
    }
    // detect optional trailing unit token at the end of the name (е.g. "Кабель ВВГ 3x2.5 м.п")
    let name = nameRaw.trim()
    let unit: string | undefined
    const unitTokens = ['шт', 'шт.', 'м', 'м.', 'м.п', 'м.п.', 'кг', 'кг.', 'л', 'л.', 'упак', 'упак.', 'пач', 'пач.', 'комп', 'комп.']
    const lastSpace = name.lastIndexOf(' ')
    if (lastSpace > 0) {
      const tail = name.slice(lastSpace + 1).toLowerCase()
      if (unitTokens.includes(tail)) {
        unit = tail
        name = name.slice(0, lastSpace).trim()
      }
    }
    items.push({ rawName: name, quantity: qty, pricePerUnit: price, unit })
  }

  return items
}

async function matchContractor(text: string) {
  // try a few labelled patterns first
  const labels = [
    /Постачальник[:\s]+([^\n]+)/iu,
    /Продавець[:\s]+([^\n]+)/iu,
    /Контрагент[:\s]+([^\n]+)/iu,
    /Від[:\s]+([^\n]+)/iu,
  ]
  let candidate: string | undefined
  for (const re of labels) {
    const m = text.match(re)
    if (m && m[1]) {
      candidate = m[1].trim().split(/\s{2,}|;|\|/)[0].slice(0, 200)
      break
    }
  }

  const contractors = await prisma.contractor.findMany({ select: { id: true, name: true } })
  if (candidate) {
    const norm = normalize(candidate)
    const exact = contractors.find((c) => normalize(c.name) === norm)
    if (exact) return { contractorId: exact.id, contractorName: exact.name }
    const partial = contractors.find(
      (c) => norm.includes(normalize(c.name)) || normalize(c.name).includes(norm),
    )
    if (partial) return { contractorId: partial.id, contractorName: partial.name }
    return { contractorName: candidate }
  }

  // No label — try to find any contractor whose name occurs in the text
  const normText = normalize(text)
  const found = contractors.find((c) => c.name && normText.includes(normalize(c.name)))
  if (found) return { contractorId: found.id, contractorName: found.name }
  return {}
}

async function matchProducts(items: ParsedInvoiceItem[]) {
  if (items.length === 0) return
  const products = await prisma.product.findMany({
    select: { id: true, name: true, sku: true, unit: true },
  })
  if (products.length === 0) return

  for (const item of items) {
    const itemNorm = normalize(item.rawName)
    if (!itemNorm) continue

    // 1) try SKU contained in name
    const bySku = products.find(
      (p) => p.sku && itemNorm.includes(normalize(p.sku)),
    )
    if (bySku) {
      item.productId = bySku.id
      item.matchedSku = bySku.sku ?? undefined
      item.matchedName = bySku.name
      if (!item.unit && bySku.unit) item.unit = bySku.unit
      continue
    }

    // 2) exact name match
    const exact = products.find((p) => normalize(p.name) === itemNorm)
    if (exact) {
      item.productId = exact.id
      item.matchedName = exact.name
      item.matchedSku = exact.sku ?? undefined
      if (!item.unit && exact.unit) item.unit = exact.unit
      continue
    }

    // 3) longest substring match
    let best: { id: string; name: string; sku: string | null; unit: string; score: number } | null = null
    for (const p of products) {
      const pn = normalize(p.name)
      if (!pn || pn.length < 4) continue
      let score = 0
      if (itemNorm.includes(pn)) score = pn.length
      else if (pn.includes(itemNorm)) score = itemNorm.length
      if (score > (best?.score ?? 0)) {
        best = { id: p.id, name: p.name, sku: p.sku, unit: p.unit, score }
      }
    }
    if (best && best.score >= 5) {
      item.productId = best.id
      item.matchedName = best.name
      item.matchedSku = best.sku ?? undefined
      if (!item.unit && best.unit) item.unit = best.unit
    }
  }
}

export async function parseInvoicePdf(buffer: Buffer): Promise<ParsedInvoice> {
  const warnings: string[] = []
  let text = ''
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const res = await parser.getText()
    text = res.text ?? ''
    await parser.destroy()
  } catch (e: any) {
    throw new Error(`Не вдалося прочитати PDF: ${e?.message || e}`)
  }

  if (!text.trim()) {
    warnings.push('PDF не містить текстового шару — імовірно скан. Парсинг неможливий.')
  }

  const number = extractNumber(text)
  const date = extractDate(text)
  const items = extractItems(text)
  if (items.length === 0 && text.trim()) {
    warnings.push('Не вдалося знайти позиції накладної. Заповніть вручну.')
  }

  const contractor = await matchContractor(text)
  await matchProducts(items)

  return {
    number,
    date,
    contractorId: contractor.contractorId,
    contractorName: contractor.contractorName,
    items,
    rawText: text,
    warnings,
  }
}
