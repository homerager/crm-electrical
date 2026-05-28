import { prisma } from './prisma'

export interface SupplyRecord {
  contractor: { id: string; name: string } | null
  invoice: { id: string; number: string; date: string }
  quantity: number
  pricePerUnit: number
}

export async function getProductSupplyHistory(
  productIds: string[],
  warehouseId?: string,
): Promise<Map<string, SupplyRecord[]>> {
  if (productIds.length === 0) return new Map()

  const where: any = {
    productId: { in: productIds },
    invoice: { type: 'INCOMING' as const },
  }
  if (warehouseId) {
    where.invoice.warehouseId = warehouseId
  }

  const items = await prisma.invoiceItem.findMany({
    where,
    include: {
      invoice: {
        include: { contractor: { select: { id: true, name: true } } },
        // only need these fields from the invoice
      },
    },
    orderBy: { invoice: { date: 'desc' } },
  })

  const map = new Map<string, SupplyRecord[]>()

  for (const item of items) {
    const record: SupplyRecord = {
      contractor: item.invoice.contractor,
      invoice: {
        id: item.invoice.id,
        number: item.invoice.number,
        date: item.invoice.date.toISOString(),
      },
      quantity: Number(item.quantity),
      pricePerUnit: Number(item.pricePerUnit),
    }

    const existing = map.get(item.productId)
    if (existing) {
      existing.push(record)
    } else {
      map.set(item.productId, [record])
    }
  }

  return map
}

/**
 * Зважена середня собівартість одиниці (weighted average cost) по всіх
 * ВХІДНИХ (INCOMING) накладних для заданих пар продукт+склад.
 *
 * сер.ціна = Σ(кількість × ціна) / Σ(кількість)
 *
 * Це коректно враховує надходження одного товару від різних постачальників
 * за різними цінами, на відміну від «ціни з останньої накладної».
 *
 * Повертає Map з ключем `${productId}:${warehouseId}` → ціна (null, якщо для
 * цієї пари немає вхідних надходжень).
 */
export async function getWeightedAverageUnitPrices(
  pairs: { productId: string; warehouseId: string }[],
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()
  if (pairs.length === 0) return result

  const productIds = [...new Set(pairs.map((p) => p.productId))]
  const warehouseIds = [...new Set(pairs.map((p) => p.warehouseId))]

  const items = await prisma.invoiceItem.findMany({
    where: {
      productId: { in: productIds },
      invoice: { type: 'INCOMING', warehouseId: { in: warehouseIds } },
    },
    select: {
      productId: true,
      quantity: true,
      pricePerUnit: true,
      invoice: { select: { warehouseId: true } },
    },
  })

  const acc = new Map<string, { qty: number; cost: number }>()
  for (const item of items) {
    const whId = item.invoice.warehouseId
    if (!whId) continue
    const key = `${item.productId}:${whId}`
    const qty = Number(item.quantity)
    const entry = acc.get(key) ?? { qty: 0, cost: 0 }
    entry.qty += qty
    entry.cost += qty * Number(item.pricePerUnit)
    acc.set(key, entry)
  }

  for (const pair of pairs) {
    const key = `${pair.productId}:${pair.warehouseId}`
    if (result.has(key)) continue
    const entry = acc.get(key)
    result.set(key, entry && entry.qty > 0 ? entry.cost / entry.qty : null)
  }

  return result
}

/**
 * Attaches `supplyHistory` array to each item in a list, keyed by productId.
 */
export function attachSupplyHistory<T extends { productId: string }>(
  items: T[],
  historyMap: Map<string, SupplyRecord[]>,
): (T & { supplyHistory: SupplyRecord[] })[] {
  return items.map((item) => ({
    ...item,
    supplyHistory: historyMap.get(item.productId) ?? [],
  }))
}
