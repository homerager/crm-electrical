import { setResponseHeader } from 'h3'
import {
  buildEstimatePdf,
  buildActPdf,
  buildContractPdf,
  type MaterialRow,
  type LaborRow,
  type ClientInfo,
  type ObjectInfo,
} from '../../utils/documentPdf'

type DocType = 'estimate' | 'act' | 'contract'

interface RequestBody {
  type: DocType
  objectId: string
  clientId?: string
  number: string
  date: string
  periodFrom?: string
  periodTo?: string
  totalAmount?: number
  prepaymentPercent?: number
  warrantyMonths?: number
  notes?: string
  /** Override VAT % for this document. If omitted, uses object.clientVatPercent or settings.defaultClientVatPercent */
  vatPercent?: number
}

async function gatherMaterials(objectId: string): Promise<MaterialRow[]> {
  const movements = await prisma.movement.findMany({
    where: { objectId, type: 'WAREHOUSE_TO_OBJECT' },
    include: { items: { include: { product: true } }, fromWarehouse: true },
  })

  const priceCache = new Map<string, number | null>()

  async function latestInvoiceUnitPrice(productId: string, warehouseId: string): Promise<number | null> {
    const key = `${productId}:${warehouseId}`
    if (priceCache.has(key)) return priceCache.get(key) ?? null
    const line = await prisma.invoiceItem.findFirst({
      where: { productId, invoice: { warehouseId } },
      orderBy: { invoice: { date: 'desc' } },
      select: { pricePerUnit: true },
    })
    const p = line != null ? Number(line.pricePerUnit) : null
    priceCache.set(key, p)
    return p
  }

  const map = new Map<string, MaterialRow & { _qty: number; _amount: number }>()

  for (const movement of movements) {
    const whId = movement.fromWarehouseId
    if (!whId) continue
    for (const item of movement.items) {
      const qty = Number(item.quantity)
      const price = await latestInvoiceUnitPrice(item.productId, whId)
      const existing = map.get(item.productId)
      if (existing) {
        existing._qty += qty
        existing._amount += price != null ? qty * price : 0
      } else {
        map.set(item.productId, {
          name: item.product.name,
          sku: item.product.sku,
          unit: item.product.unit,
          quantity: qty,
          pricePerUnit: price ?? 0,
          _qty: qty,
          _amount: price != null ? qty * price : 0,
        })
      }
    }
  }

  return Array.from(map.values()).map((row) => ({
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    quantity: row._qty,
    pricePerUnit: row._qty > 0 ? row._amount / row._qty : 0,
  })).sort((a, b) => a.name.localeCompare(b.name))
}

async function gatherLabor(objectId: string): Promise<LaborRow[]> {
  const timeLogs = await prisma.timeLog.findMany({
    where: {
      OR: [
        { task: { objectId, status: 'DONE' } },
        { objectId, taskId: null },
      ],
    },
    include: { user: { select: { id: true, name: true, hourlyRate: true } } },
  })

  const map = new Map<string, LaborRow>()
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
      entry.totalAmount = Math.round(entry.totalHours * entry.hourlyRate * 100) / 100
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
}

function toClientInfo(c: any): ClientInfo {
  return {
    name: c.name,
    contactPerson: c.contactPerson,
    phone: c.phone,
    email: c.email,
    address: c.address,
    taxCode: c.taxCode,
    iban: c.iban,
    bankName: c.bankName,
    bankMfo: c.bankMfo,
  }
}

function toObjectInfo(o: any): ObjectInfo {
  return { name: o.name, address: o.address }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body.type || !body.objectId || !body.number || !body.date) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть type, objectId, number, date' })
  }

  const [object, globalSettings] = await Promise.all([
    prisma.constructionObject.findUnique({ where: { id: body.objectId }, include: { client: true } }),
    prisma.settings.findUnique({ where: { id: 'global' } }),
  ])
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Об\'єкт не знайдено' })

  // Per-object markupPercent overrides both global defaults; otherwise use global per-category defaults
  const objectMarkup = object.markupPercent != null ? Number(object.markupPercent) : null
  const materialMarkupPercent = objectMarkup ?? (globalSettings?.defaultMaterialMarkupPercent != null ? Number(globalSettings.defaultMaterialMarkupPercent) : undefined)
  const laborMarkupPercent = objectMarkup ?? (globalSettings?.defaultLaborMarkupPercent != null ? Number(globalSettings.defaultLaborMarkupPercent) : undefined)

  // VAT for client documents: body override → object level → global default → 0
  const clientVatPercent = body.vatPercent != null
    ? body.vatPercent
    : object.clientVatPercent != null
      ? Number(object.clientVatPercent)
      : globalSettings?.defaultClientVatPercent != null
        ? Number(globalSettings.defaultClientVatPercent)
        : 0

  let client: any = null
  if (body.clientId) {
    client = await prisma.client.findUnique({ where: { id: body.clientId } })
    if (!client) throw createError({ statusCode: 404, statusMessage: 'Клієнта не знайдено' })
  } else if (object.client) {
    client = object.client
  }

  let buffer: Buffer
  let asciiName: string
  let utfName: string

  const safeNumber = body.number.replace(/[^\w.-]+/g, '_')

  switch (body.type) {
    case 'estimate': {
      const materials = await gatherMaterials(body.objectId)
      const labor = await gatherLabor(body.objectId)
      buffer = await buildEstimatePdf({
        object: toObjectInfo(object),
        client: client ? toClientInfo(client) : null,
        materials,
        labor,
        number: body.number,
        date: body.date,
        materialMarkupPercent,
        laborMarkupPercent,
        vatPercent: clientVatPercent,
        notes: body.notes,
      })
      asciiName = `koshtorys-${safeNumber}.pdf`
      utfName = `Кошторис-${body.number}.pdf`
      break
    }

    case 'act': {
      const materials = await gatherMaterials(body.objectId)
      const labor = await gatherLabor(body.objectId)
      buffer = await buildActPdf({
        object: toObjectInfo(object),
        client: client ? toClientInfo(client) : null,
        materials,
        labor,
        number: body.number,
        date: body.date,
        periodFrom: body.periodFrom,
        periodTo: body.periodTo,
        materialMarkupPercent,
        laborMarkupPercent,
        vatPercent: clientVatPercent,
        notes: body.notes,
      })
      asciiName = `akt-${safeNumber}.pdf`
      utfName = `Акт-${body.number}.pdf`
      break
    }

    case 'contract': {
      if (!client) {
        throw createError({ statusCode: 400, statusMessage: 'Для договору потрібен клієнт' })
      }
      const materials = await gatherMaterials(body.objectId)
      const labor = await gatherLabor(body.objectId)
      const matMarkup = 1 + (materialMarkupPercent ?? 0) / 100
      const labMarkup = 1 + (laborMarkupPercent ?? 0) / 100
      const matSum = materials.reduce((s, m) => s + m.quantity * m.pricePerUnit * matMarkup, 0)
      const labSum = labor.reduce((s, l) => s + (l.totalAmount != null ? l.totalAmount * labMarkup : 0), 0)
      const baseTotal = matSum + labSum
      const vatMultiplier = 1 + clientVatPercent / 100
      const autoTotal = baseTotal * vatMultiplier

      buffer = await buildContractPdf({
        object: toObjectInfo(object),
        client: toClientInfo(client),
        number: body.number,
        date: body.date,
        totalAmount: body.totalAmount ?? autoTotal,
        prepaymentPercent: body.prepaymentPercent,
        warrantyMonths: body.warrantyMonths,
        vatPercent: clientVatPercent,
        notes: body.notes,
      })
      asciiName = `dohovir-${safeNumber}.pdf`
      utfName = `Договір-${body.number}.pdf`
      break
    }

    default:
      throw createError({ statusCode: 400, statusMessage: 'Невідомий тип документа' })
  }

  const query = getQuery(event)
  const inline = query.inline === '1' || query.inline === 'true'

  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(
    event,
    'content-disposition',
    inline
      ? `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utfName)}`
      : `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utfName)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, no-cache')

  return buffer
})
