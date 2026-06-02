import { isElevatedRole } from '../../utils/authz'

type ImportRow = {
  contractor?: string
  sku?: string
  product?: string
  price?: string | number
  currency?: string
  vatPercent?: string | number
  validFrom?: string
  validTo?: string
  note?: string
}

type RowError = { row: number; message: string }

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{ items?: ImportRow[]; contractorId?: string }>(event)
  const items = Array.isArray(body?.items) ? body!.items : []
  const fixedContractorId = body?.contractorId?.trim() || null

  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'Файл порожній або не містить рядків' })
  }
  if (items.length > 5000) {
    throw createError({ statusCode: 400, statusMessage: 'Забагато рядків (максимум 5000)' })
  }

  // Resolve a single contractor up-front if provided
  let fixedContractor: { id: string } | null = null
  if (fixedContractorId) {
    fixedContractor = await prisma.contractor.findUnique({ where: { id: fixedContractorId }, select: { id: true } })
    if (!fixedContractor) throw createError({ statusCode: 404, statusMessage: 'Постачальника не знайдено' })
  }

  // Pre-load lookup tables
  const contractors = await prisma.contractor.findMany({ select: { id: true, name: true } })
  const contractorByName = new Map(contractors.map((c) => [c.name.trim().toLowerCase(), c.id]))

  const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true } })
  const productBySku = new Map<string, string>()
  const productByName = new Map<string, string>()
  for (const p of products) {
    if (p.sku) productBySku.set(p.sku.trim().toLowerCase(), p.id)
    productByName.set(p.name.trim().toLowerCase(), p.id)
  }

  const errors: RowError[] = []
  let created = 0
  let updated = 0

  for (let i = 0; i < items.length; i++) {
    const raw = items[i]
    const rowNum = i + 2

    const contractorId = fixedContractor
      ? fixedContractor.id
      : contractorByName.get((raw?.contractor || '').toString().trim().toLowerCase())
    if (!contractorId) {
      errors.push({ row: rowNum, message: `Постачальника "${raw?.contractor || ''}" не знайдено` })
      continue
    }

    const sku = (raw?.sku || '').toString().trim().toLowerCase()
    const productName = (raw?.product || '').toString().trim().toLowerCase()
    const productId = (sku && productBySku.get(sku)) || (productName && productByName.get(productName))
    if (!productId) {
      errors.push({ row: rowNum, message: `Товар "${raw?.product || raw?.sku || ''}" не знайдено` })
      continue
    }

    const price = Number(raw?.price)
    if (!Number.isFinite(price) || price < 0) {
      errors.push({ row: rowNum, message: 'Некоректна ціна' })
      continue
    }

    const vatRaw = raw?.vatPercent
    const vatPercent = vatRaw == null || vatRaw === '' ? 0 : Number(vatRaw)
    if (!Number.isFinite(vatPercent) || vatPercent < 0) {
      errors.push({ row: rowNum, message: 'Некоректний ПДВ' })
      continue
    }

    const validFrom = raw?.validFrom ? new Date(raw.validFrom) : new Date()
    if (Number.isNaN(validFrom.getTime())) {
      errors.push({ row: rowNum, message: 'Некоректна дата початку дії' })
      continue
    }
    const validTo = raw?.validTo ? new Date(raw.validTo) : null
    if (validTo && Number.isNaN(validTo.getTime())) {
      errors.push({ row: rowNum, message: 'Некоректна дата завершення дії' })
      continue
    }

    const currency = (raw?.currency || '').toString().trim() || 'UAH'
    const note = (raw?.note || '').toString().trim() || null

    try {
      const existing = await prisma.supplierPrice.findUnique({
        where: { contractorId_productId_validFrom: { contractorId, productId, validFrom } },
      })
      if (existing) {
        await prisma.supplierPrice.update({
          where: { id: existing.id },
          data: { price, currency, vatPercent, validTo, isActive: true, note },
        })
        updated++
      } else {
        const row = await prisma.supplierPrice.create({
          data: { contractorId, productId, price, currency, vatPercent, validFrom, validTo, isActive: true, note, createdById: auth!.userId },
        })
        created++
        writeAuditLog({
          userId: auth!.userId,
          userName: auth!.name,
          action: 'CREATE',
          entityType: 'SupplierPrice',
          entityId: row.id,
          changes: { contractorId, productId, price, source: 'bulk-import' },
        })
      }
    } catch (e: any) {
      errors.push({ row: rowNum, message: e?.message || 'Помилка збереження' })
    }
  }

  return { created, updated, totalRows: items.length, errors }
})
