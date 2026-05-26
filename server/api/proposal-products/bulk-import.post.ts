import { isElevatedRole } from '../../utils/authz'

type ImportRow = {
  name?: string
  description?: string
  sku?: string
  unit?: string
  groupName?: string
  priceExVat?: string | number
  vatPercent?: string | number
  notes?: string
}

type RowError = { row: number; message: string }

const DEFAULT_UNIT = 'шт'
const DEFAULT_VAT = 20

function parseNumber(value: unknown): number | null {
  if (value === '' || value == null) return null
  const raw = String(value).trim().replace(/\s+/g, '').replace(',', '.')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{ items?: ImportRow[] }>(event)
  const items = Array.isArray(body?.items) ? body!.items : []

  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'Файл порожній або не містить рядків' })
  }
  if (items.length > 5000) {
    throw createError({ statusCode: 400, statusMessage: 'Забагато рядків (максимум 5000)' })
  }

  const errors: RowError[] = []
  const cleaned: { rowIndex: number; data: { name: string; description: string | null; sku: string | null; unit: string; groupName: string | null; priceExVat: number; vatPercent: number; notes: string | null } }[] = []

  items.forEach((raw, idx) => {
    const rowNum = idx + 2
    const name = (raw?.name || '').toString().trim()
    if (!name) {
      errors.push({ row: rowNum, message: 'Назва порожня' })
      return
    }
    const priceExVat = parseNumber(raw?.priceExVat) ?? 0
    if (priceExVat < 0) {
      errors.push({ row: rowNum, message: 'Ціна не може бути відʼємною' })
      return
    }
    let vatPercent = parseNumber(raw?.vatPercent)
    if (vatPercent == null) vatPercent = DEFAULT_VAT
    if (vatPercent < 0 || vatPercent > 100) {
      errors.push({ row: rowNum, message: `Некоректна ставка ПДВ: ${vatPercent}` })
      return
    }

    cleaned.push({
      rowIndex: rowNum,
      data: {
        name,
        description: (raw?.description || '').toString().trim() || null,
        sku: (raw?.sku || '').toString().trim() || null,
        unit: (raw?.unit || '').toString().trim() || DEFAULT_UNIT,
        groupName: (raw?.groupName || '').toString().trim() || null,
        priceExVat,
        vatPercent,
        notes: (raw?.notes || '').toString().trim() || null,
      },
    })
  })

  let created = 0
  for (const item of cleaned) {
    try {
      const product = await prisma.proposalProduct.create({ data: item.data })
      created++
      writeAuditLog({
        userId: auth!.userId,
        userName: auth!.name,
        action: 'CREATE',
        entityType: 'Product',
        entityId: product.id,
        changes: { name: product.name, sku: product.sku, unit: product.unit, source: 'bulk-import-proposal' },
      })
    } catch (e: any) {
      errors.push({ row: item.rowIndex, message: e?.message || 'Помилка створення' })
    }
  }

  return { created, totalRows: items.length, errors }
})
