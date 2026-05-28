/**
 * Shared types and helpers for saved documents (estimate / act / contract).
 *
 * A document stores a self-contained snapshot of the object's data in its
 * `data` JSON column. Prices in the snapshot are FINAL — any markup is baked
 * in at creation time, so the user edits real prices afterwards.
 */

export type DocType = 'estimate' | 'act' | 'contract'

/** Maps the lowercase API/UI type to the Prisma `DocumentType` enum. */
export const DOC_TYPE_TO_ENUM = {
  estimate: 'ESTIMATE',
  act: 'ACT',
  contract: 'CONTRACT',
} as const

/** Maps the Prisma `DocumentType` enum back to the lowercase API/UI type. */
export const DOC_TYPE_FROM_ENUM = {
  ESTIMATE: 'estimate',
  ACT: 'act',
  CONTRACT: 'contract',
} as const

export interface DocClientInfo {
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxCode: string | null
  iban: string | null
  bankName: string | null
  bankMfo: string | null
}

export interface DocObjectInfo {
  name: string
  address: string | null
}

export interface DocMaterialRow {
  name: string
  sku: string | null
  unit: string
  quantity: number
  /** Final price per unit — markup already applied */
  pricePerUnit: number
}

export interface DocLaborRow {
  userName: string
  totalHours: number
  /** Final hourly rate — markup already applied */
  hourlyRate: number | null
  /** Final amount = totalHours * hourlyRate */
  totalAmount: number | null
}

/** Shape of the `Document.data` JSON column. */
export interface DocumentData {
  object: DocObjectInfo
  client: DocClientInfo | null
  /** VAT % charged to the client. 0 = no VAT line. */
  vatPercent: number
  /** estimate / act */
  materials?: DocMaterialRow[]
  labor?: DocLaborRow[]
  /** act only */
  periodFrom?: string | null
  periodTo?: string | null
  /** contract only — gross amount (incl. VAT) */
  totalAmount?: number
  prepaymentPercent?: number | null
  warrantyMonths?: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Computes the base / VAT / grand total of a document from its snapshot. */
export function computeDocumentTotal(
  type: DocType,
  data: DocumentData,
): { base: number; vatAmount: number; total: number } {
  const vatPct = Number(data.vatPercent) || 0
  if (type === 'contract') {
    const total = Number(data.totalAmount) || 0
    const base = vatPct > 0 ? total / (1 + vatPct / 100) : total
    return { base: round2(base), vatAmount: round2(total - base), total: round2(total) }
  }
  const matSum = (data.materials ?? []).reduce(
    (s, m) => s + (Number(m.quantity) || 0) * (Number(m.pricePerUnit) || 0),
    0,
  )
  const labSum = (data.labor ?? []).reduce((s, l) => s + (Number(l.totalAmount) || 0), 0)
  const base = matSum + labSum
  const vatAmount = base * vatPct / 100
  return { base: round2(base), vatAmount: round2(vatAmount), total: round2(base + vatAmount) }
}

export function toDocClientInfo(c: any): DocClientInfo {
  return {
    name: c.name,
    contactPerson: c.contactPerson ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    address: c.address ?? null,
    taxCode: c.taxCode ?? null,
    iban: c.iban ?? null,
    bankName: c.bankName ?? null,
    bankMfo: c.bankMfo ?? null,
  }
}

export function toDocObjectInfo(o: any): DocObjectInfo {
  return { name: o.name, address: o.address ?? null }
}

/** Aggregates materials moved warehouse→object, priced from the latest invoice. */
export async function gatherMaterials(objectId: string): Promise<DocMaterialRow[]> {
  const movements = await prisma.movement.findMany({
    where: { objectId, type: 'WAREHOUSE_TO_OBJECT' },
    include: { items: { include: { product: true } }, fromWarehouse: true },
  })

  const pricePairs: { productId: string; warehouseId: string }[] = []
  for (const movement of movements) {
    if (!movement.fromWarehouseId) continue
    for (const item of movement.items) {
      pricePairs.push({ productId: item.productId, warehouseId: movement.fromWarehouseId })
    }
  }
  const priceMap = await getWeightedAverageUnitPrices(pricePairs)

  const map = new Map<string, { name: string; sku: string | null; unit: string; qty: number; amount: number }>()

  for (const movement of movements) {
    const whId = movement.fromWarehouseId
    if (!whId) continue
    for (const item of movement.items) {
      const qty = Number(item.quantity)
      const price = priceMap.get(`${item.productId}:${whId}`) ?? null
      const existing = map.get(item.productId)
      if (existing) {
        existing.qty += qty
        existing.amount += price != null ? qty * price : 0
      } else {
        map.set(item.productId, {
          name: item.product.name,
          sku: item.product.sku,
          unit: item.product.unit,
          qty,
          amount: price != null ? qty * price : 0,
        })
      }
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      quantity: row.qty,
      pricePerUnit: row.qty > 0 ? row.amount / row.qty : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Aggregates time logs into per-worker labour rows. */
export async function gatherLabor(objectId: string): Promise<DocLaborRow[]> {
  const timeLogs = await prisma.timeLog.findMany({
    where: {
      OR: [
        { task: { objectId, status: 'DONE' } },
        { objectId, taskId: null },
      ],
    },
    include: { user: { select: { id: true, name: true, hourlyRate: true } } },
  })

  const map = new Map<string, DocLaborRow>()
  for (const log of timeLogs) {
    const uid = log.userId
    const rate = log.user.hourlyRate != null ? Number(log.user.hourlyRate) : null
    if (!map.has(uid)) {
      map.set(uid, { userName: log.user.name, totalHours: 0, hourlyRate: rate, totalAmount: null })
    }
    const entry = map.get(uid)!
    if (entry.hourlyRate == null && rate != null) entry.hourlyRate = rate
    entry.totalHours += log.hours
  }
  for (const entry of map.values()) {
    if (entry.hourlyRate != null) {
      entry.totalAmount = round2(entry.totalHours * entry.hourlyRate)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) ? n : 0
}
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = num(v)
  return Number.isFinite(n) ? n : null
}
const strOrNull = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Coerces incoming (possibly string-typed) document data into a clean snapshot. */
export function normalizeDocumentData(type: DocType, raw: any): DocumentData {
  const r = raw ?? {}
  const obj = r.object ?? {}
  const data: DocumentData = {
    object: { name: String(obj.name ?? '').trim(), address: strOrNull(obj.address) },
    client: null,
    vatPercent: num(r.vatPercent),
  }

  if (r.client && (r.client.name || r.client.taxCode || r.client.iban)) {
    const c = r.client
    data.client = {
      name: String(c.name ?? '').trim(),
      contactPerson: strOrNull(c.contactPerson),
      phone: strOrNull(c.phone),
      email: strOrNull(c.email),
      address: strOrNull(c.address),
      taxCode: strOrNull(c.taxCode),
      iban: strOrNull(c.iban),
      bankName: strOrNull(c.bankName),
      bankMfo: strOrNull(c.bankMfo),
    }
  }

  if (type === 'estimate' || type === 'act') {
    data.materials = (Array.isArray(r.materials) ? r.materials : [])
      .map((m: any) => ({
        name: String(m.name ?? '').trim(),
        sku: strOrNull(m.sku),
        unit: String(m.unit ?? 'шт').trim() || 'шт',
        quantity: num(m.quantity),
        pricePerUnit: num(m.pricePerUnit),
      }))
      .filter((m: DocMaterialRow) => m.name !== '')

    data.labor = (Array.isArray(r.labor) ? r.labor : [])
      .map((l: any) => {
        const hours = num(l.totalHours)
        const rate = numOrNull(l.hourlyRate)
        return {
          userName: String(l.userName ?? '').trim(),
          totalHours: hours,
          hourlyRate: rate,
          totalAmount: rate != null ? round2(hours * rate) : null,
        }
      })
      .filter((l: DocLaborRow) => l.userName !== '')

    if (type === 'act') {
      data.periodFrom = strOrNull(r.periodFrom)
      data.periodTo = strOrNull(r.periodTo)
    }
  }

  if (type === 'contract') {
    data.totalAmount = num(r.totalAmount)
    data.prepaymentPercent = numOrNull(r.prepaymentPercent)
    data.warrantyMonths = numOrNull(r.warrantyMonths)
  }

  return data
}

interface SnapshotOptions {
  type: DocType
  object: any
  client: any | null
  globalSettings: any | null
  /** Optional VAT % override; falls back to object → global → 0 */
  vatPercent?: number | null
}

/**
 * Builds the initial `DocumentData` snapshot for a freshly created document.
 * Markup is applied to prices here and NOT stored separately — the user edits
 * final prices from then on.
 */
export async function buildDocumentSnapshot(opts: SnapshotOptions): Promise<DocumentData> {
  const { type, object, client, globalSettings } = opts

  const objectMarkup = object.markupPercent != null ? Number(object.markupPercent) : null
  const materialMarkup = objectMarkup
    ?? (globalSettings?.defaultMaterialMarkupPercent != null ? Number(globalSettings.defaultMaterialMarkupPercent) : 0)
  const laborMarkup = objectMarkup
    ?? (globalSettings?.defaultLaborMarkupPercent != null ? Number(globalSettings.defaultLaborMarkupPercent) : 0)

  const vatPercent = opts.vatPercent != null
    ? opts.vatPercent
    : object.clientVatPercent != null
      ? Number(object.clientVatPercent)
      : globalSettings?.defaultClientVatPercent != null
        ? Number(globalSettings.defaultClientVatPercent)
        : 0

  const data: DocumentData = {
    object: toDocObjectInfo(object),
    client: client ? toDocClientInfo(client) : null,
    vatPercent,
  }

  if (type === 'estimate' || type === 'act') {
    const matFactor = 1 + materialMarkup / 100
    const labFactor = 1 + laborMarkup / 100

    const rawMaterials = await gatherMaterials(object.id)
    data.materials = rawMaterials.map((m) => ({
      name: m.name,
      sku: m.sku,
      unit: m.unit,
      quantity: m.quantity,
      pricePerUnit: round2(m.pricePerUnit * matFactor),
    }))

    const rawLabor = await gatherLabor(object.id)
    data.labor = rawLabor.map((l) => {
      const rate = l.hourlyRate != null ? round2(l.hourlyRate * labFactor) : null
      return {
        userName: l.userName,
        totalHours: l.totalHours,
        hourlyRate: rate,
        totalAmount: rate != null ? round2(l.totalHours * rate) : null,
      }
    })

    if (type === 'act') {
      data.periodFrom = null
      data.periodTo = null
    }
  }

  if (type === 'contract') {
    const matFactor = 1 + materialMarkup / 100
    const labFactor = 1 + laborMarkup / 100
    const rawMaterials = await gatherMaterials(object.id)
    const rawLabor = await gatherLabor(object.id)
    const matSum = rawMaterials.reduce((s, m) => s + m.quantity * m.pricePerUnit * matFactor, 0)
    const labSum = rawLabor.reduce((s, l) => s + (l.totalAmount != null ? l.totalAmount * labFactor : 0), 0)
    const baseTotal = matSum + labSum
    data.totalAmount = round2(baseTotal * (1 + vatPercent / 100))
    data.prepaymentPercent = null
    data.warrantyMonths = 12
  }

  return data
}
