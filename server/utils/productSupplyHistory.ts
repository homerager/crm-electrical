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
