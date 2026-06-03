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

/** Normalizes a date to UTC midnight so supplier prices are deduplicated per day. */
function toDateOnly(input: string | Date): Date {
  const d = new Date(input)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export interface InvoicePriceItem {
  productId: string
  pricePerUnit: number | string
  vatPercent?: number | string
}

/**
 * Records actual purchase prices from an INCOMING invoice into supplier price lists.
 * For each line item, if there is no active price for (contractor, product) or the
 * price/VAT differs, the previous active price(s) are closed and a new active price
 * is created/updated with validFrom = invoice date.
 *
 * Designed to run AFTER the invoice transaction commits — failures here never block
 * invoice creation (each item is isolated and errors are swallowed).
 */
export async function syncSupplierPricesFromInvoice(params: {
  contractorId?: string | null
  type: string
  date: string | Date
  items: InvoicePriceItem[]
  userId?: string | null
  userName?: string | null
}): Promise<{ created: number; updated: number }> {
  const summary = { created: 0, updated: 0 }
  if (params.type !== 'INCOMING' || !params.contractorId) return summary

  const contractorId = params.contractorId
  const validFrom = toDateOnly(params.date)

  // Collapse duplicate products in a single invoice — keep the last occurrence.
  const byProduct = new Map<string, InvoicePriceItem>()
  for (const item of params.items ?? []) {
    if (!item?.productId) continue
    const price = Number(item.pricePerUnit)
    if (!Number.isFinite(price) || price <= 0) continue
    byProduct.set(item.productId, item)
  }

  for (const [productId, item] of byProduct) {
    try {
      const price = Number(item.pricePerUnit)
      const vatPercent = Number(item.vatPercent ?? 0)

      const activePrices = await prisma.supplierPrice.findMany({
        where: { contractorId, productId, isActive: true },
        orderBy: { validFrom: 'desc' },
      })
      const current = activePrices[0]
      const unchanged = current
        && Math.abs(Number(current.price) - price) < 0.005
        && Number(current.vatPercent) === vatPercent
      if (unchanged) continue

      // Close out existing active prices before recording the new one.
      if (activePrices.length) {
        await prisma.supplierPrice.updateMany({
          where: { contractorId, productId, isActive: true },
          data: { isActive: false },
        })
      }

      const existingSameDay = await prisma.supplierPrice.findUnique({
        where: { contractorId_productId_validFrom: { contractorId, productId, validFrom } },
      })

      if (existingSameDay) {
        await prisma.supplierPrice.update({
          where: { id: existingSameDay.id },
          data: { price, vatPercent, isActive: true, validTo: null },
        })
        summary.updated++
        writeAuditLog({
          userId: params.userId ?? null,
          userName: params.userName ?? null,
          action: 'UPDATE',
          entityType: 'SupplierPrice',
          entityId: existingSameDay.id,
          changes: { contractorId, productId, price, vatPercent, source: 'invoice' },
        })
      } else {
        const created = await prisma.supplierPrice.create({
          data: {
            contractorId,
            productId,
            price,
            vatPercent,
            currency: 'UAH',
            validFrom,
            isActive: true,
            note: 'Автоматично з прихідної накладної',
            createdById: params.userId ?? null,
          },
        })
        summary.created++
        writeAuditLog({
          userId: params.userId ?? null,
          userName: params.userName ?? null,
          action: 'CREATE',
          entityType: 'SupplierPrice',
          entityId: created.id,
          changes: { contractorId, productId, price, vatPercent, source: 'invoice' },
        })
      }
    } catch (e) {
      console.error('[supplierPrices] sync failed for product', productId, e)
    }
  }

  return summary
}
