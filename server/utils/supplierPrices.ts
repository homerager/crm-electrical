import { prisma } from './prisma'

/**
 * Returns the best (lowest) currently active supplier price for each requested product.
 * "Active" means isActive = true and the validity window (validFrom/validTo) covers now.
 * Optionally restricts to a single contractor.
 *
 * Returns a Map keyed by productId → { contractorId, price, vatPercent, currency }.
 */
export async function getBestSupplierPrices(
  productIds: string[],
  contractorId?: string | null,
): Promise<Map<string, { contractorId: string; price: number; vatPercent: number; currency: string }>> {
  const result = new Map<string, { contractorId: string; price: number; vatPercent: number; currency: string }>()
  if (!productIds.length) return result

  const now = new Date()
  const rows = await prisma.supplierPrice.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
      ...(contractorId ? { contractorId } : {}),
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: [{ price: 'asc' }],
  })

  for (const row of rows) {
    const existing = result.get(row.productId)
    const price = Number(row.price)
    if (!existing || price < existing.price) {
      result.set(row.productId, {
        contractorId: row.contractorId,
        price,
        vatPercent: Number(row.vatPercent),
        currency: row.currency,
      })
    }
  }

  return result
}
