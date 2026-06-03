import { getProductSupplyHistory } from '../../../utils/productSupplyHistory'

/**
 * Builds a stable key for grouping movement lines into lots
 * (product + contractor + price + vat). Price/vat are normalised to 2 decimals so
 * float drift from Decimal conversion does not split an otherwise identical lot.
 */
function lotKey(productId: string, contractorId: string | null, price: number, vat: number) {
  return `${productId}|${contractorId ?? ''}|${price.toFixed(2)}|${vat.toFixed(2)}`
}

interface LotSummaryRow {
  id: string
  product: any
  contractor: { id: string; name: string } | null
  pricePerUnit: number
  vatPercent: number
  totalQuantity: number
  unit: string
  totalAmount: number
  /** Kept for backward-compat with the table column; equals the exact lot price now. */
  averageUnitPrice: number | null
  hasMissingPrice: boolean
}

/**
 * Groups movement lines into per-lot rows carrying the exact cost of each lot. Because
 * every movement line now records the lot it moved (contractor + price + vat), the cost is
 * exact and no weighted-average reconstruction is needed.
 */
function buildLotSummary(
  movements: { items: { productId: string; contractorId: string | null; pricePerUnit: unknown; vatPercent: unknown; quantity: unknown; product: any; contractor: { id: string; name: string } | null }[] }[],
): LotSummaryRow[] {
  const map = new Map<string, LotSummaryRow>()
  for (const movement of movements) {
    for (const item of movement.items) {
      const price = Number(item.pricePerUnit)
      const vat = Number(item.vatPercent)
      const qty = Number(item.quantity)
      const key = lotKey(item.productId, item.contractorId, price, vat)
      const existing = map.get(key)
      if (existing) {
        existing.totalQuantity += qty
        existing.totalAmount += qty * price
      } else {
        map.set(key, {
          id: key,
          product: item.product,
          contractor: item.contractor,
          pricePerUnit: price,
          vatPercent: vat,
          totalQuantity: qty,
          unit: item.product.unit,
          totalAmount: qty * price,
          averageUnitPrice: price,
          hasMissingPrice: false,
        })
      }
    }
  }

  return Array.from(map.values())
    .map((row) => ({ ...row, totalAmount: Math.round(row.totalAmount * 100) / 100 }))
    .sort(
      (a, b) =>
        a.product.name.localeCompare(b.product.name) ||
        (a.contractor?.name ?? '').localeCompare(b.contractor?.name ?? '') ||
        a.pricePerUnit - b.pricePerUnit,
    )
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const object = await prisma.constructionObject.findUnique({ where: { id } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  const movements = await prisma.movement.findMany({
    where: { objectId: id, type: 'WAREHOUSE_TO_OBJECT' },
    include: {
      items: { include: { product: true, contractor: { select: { id: true, name: true } } } },
      fromWarehouse: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })

  // "Відпуск зі складу" — released to the object, one row per lot with exact cost.
  const summary = buildLotSummary(movements)
  const summaryTotalAmount = Math.round(summary.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100
  const summaryHasMissingPrice = false

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      OR: [
        { task: { objectId: id, status: 'DONE' } },
        { objectId: id, taskId: null },
      ],
    },
    include: {
      user: { select: { id: true, name: true, hourlyRate: true } },
    },
    orderBy: [{ userId: 'asc' }, { date: 'desc' }],
  })

  type LaborRow = {
    userId: string
    userName: string
    totalHours: number
    hourlyRate: number | null
    totalAmount: number | null
  }

  const laborMap = new Map<string, LaborRow>()
  for (const log of timeLogs) {
    const uid = log.userId
    const rate = log.user.hourlyRate != null ? Number(log.user.hourlyRate) : null
    if (!laborMap.has(uid)) {
      laborMap.set(uid, {
        userId: uid,
        userName: log.user.name,
        totalHours: 0,
        hourlyRate: rate,
        totalAmount: null,
      })
    }
    const entry = laborMap.get(uid)!
    if (entry.hourlyRate == null && rate != null) entry.hourlyRate = rate
    entry.totalHours += log.hours
  }
  for (const entry of laborMap.values()) {
    if (entry.hourlyRate != null) {
      entry.totalAmount = Math.round(entry.totalHours * entry.hourlyRate * 100) / 100
    }
  }

  const laborByUser = Array.from(laborMap.values()).sort((a, b) => b.totalHours - a.totalHours)
  const laborTotalHours = laborByUser.reduce((s, r) => s + r.totalHours, 0)
  const laborTotalAmount = laborByUser.reduce((s, r) => s + (typeof r.totalAmount === 'number' ? r.totalAmount : 0), 0)
  const laborHasMissingRate = laborByUser.some((r) => r.hourlyRate == null)

  // Per-lot stock currently on the object (each row carries its exact supplier + price).
  const stockOnSite = await prisma.objectStock.findMany({
    where: { objectId: id, quantity: { gt: 0 } },
    include: { product: true, contractor: { select: { id: true, name: true } } },
    orderBy: [{ product: { name: 'asc' } }, { pricePerUnit: 'asc' }],
  })

  const warehouseReservations = await prisma.warehouseObjectReservation.findMany({
    where: { objectId: id },
    include: {
      warehouse: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
    orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
  })

  const writeOffMovements = await prisma.movement.findMany({
    where: { objectId: id, type: 'OBJECT_WRITE_OFF' },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true, contractor: { select: { id: true, name: true } } } },
    },
    orderBy: { date: 'desc' },
  })

  const returnMovements = await prisma.movement.findMany({
    where: { objectId: id, type: 'OBJECT_TO_WAREHOUSE' },
    include: {
      toWarehouse: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true, contractor: { select: { id: true, name: true } } } },
    },
    orderBy: { date: 'desc' },
  })

  // "Використано на обʼєкті" — written-off lots with exact cost, one row per lot.
  const consumedSummary = buildLotSummary(writeOffMovements)
  const consumedTotalAmount = Math.round(consumedSummary.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100
  const consumedHasMissingPrice = false

  const budget = object.budget != null ? Number(object.budget) : null
  const totalExpenses = summaryTotalAmount + laborTotalAmount
  const budgetRemaining = budget != null ? budget - totalExpenses : null
  const budgetUsedPercent = budget != null && budget > 0
    ? Math.round((totalExpenses / budget) * 10000) / 100
    : null

  const allProductIds = [
    ...new Set([
      ...summary.map((r) => r.product.id),
      ...stockOnSite.map((s) => s.productId),
      ...warehouseReservations.map((r) => r.productId),
      ...consumedSummary.map((r) => r.product.id),
    ]),
  ]
  const supplyMap = await getProductSupplyHistory(allProductIds)

  const enrichedSummary = summary.map((r) => ({
    ...r,
    supplyHistory: supplyMap.get(r.product.id) ?? [],
  }))
  const enrichedStockOnSite = stockOnSite.map((s) => ({
    ...s,
    supplyHistory: supplyMap.get(s.productId) ?? [],
  }))
  const enrichedReservations = warehouseReservations.map((r) => ({
    ...r,
    supplyHistory: supplyMap.get(r.productId) ?? [],
  }))
  const enrichedConsumed = consumedSummary.map((r) => ({
    ...r,
    supplyHistory: supplyMap.get(r.product.id) ?? [],
  }))

  return {
    object,
    warehouseReservations: enrichedReservations,
    movements,
    summary: enrichedSummary,
    summaryTotalAmount,
    summaryHasMissingPrice,
    stockOnSite: enrichedStockOnSite,
    consumedSummary: enrichedConsumed,
    consumedTotalAmount,
    consumedHasMissingPrice,
    writeOffMovements,
    returnMovements,
    laborByUser,
    laborTotalHours,
    laborTotalAmount,
    laborHasMissingRate,
    laborLogCount: timeLogs.length,
    budget,
    totalExpenses,
    budgetRemaining,
    budgetUsedPercent,
  }
})
