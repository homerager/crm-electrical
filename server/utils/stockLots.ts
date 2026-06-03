import type { Prisma } from '@prisma/client'

/**
 * Helpers for "lot"-based stock tracking.
 *
 * A stock lot is identified by (warehouse|object, product, contractorId, pricePerUnit).
 * Two intakes with the same supplier and the same unit price merge into one lot;
 * any difference in supplier or price produces a separate lot. `vatPercent` is stored
 * as an attribute of the lot and is NOT part of the merge key.
 *
 * `contractorId` is nullable (legacy lots have no known supplier), so lot dedup is done
 * here in application code (find-then-create) rather than relying solely on the DB unique
 * constraint, which treats NULLs as distinct on most engines.
 */

const EPS = 1e-9

/** A consumed slice of stock, carrying the exact cost dimensions of the lot it came from. */
export interface LotSlice {
  contractorId: string | null
  pricePerUnit: number
  vatPercent: number
  quantity: number
}

/** Rounds a unit price to 2 decimals to match the Decimal(12,2) storage and avoid float drift. */
function normalizePrice(price: number | string): number {
  const n = Number(price)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function normalizeVat(vat: number | string): number {
  const n = Number(vat)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Warehouse lots
// ---------------------------------------------------------------------------

/**
 * Finds the warehouse lot matching (warehouse, product, contractor, price), creating it
 * with zero quantity if it does not exist yet. `vatPercent` is written only on creation.
 */
export async function resolveWarehouseLot(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
  contractorId: string | null,
  price: number | string,
  vat: number | string,
) {
  const pricePerUnit = normalizePrice(price)
  const existing = await tx.warehouseStock.findFirst({
    where: { warehouseId, productId, contractorId: contractorId ?? null, pricePerUnit },
  })
  if (existing) return existing

  return tx.warehouseStock.create({
    data: {
      warehouseId,
      productId,
      contractorId: contractorId ?? null,
      pricePerUnit,
      vatPercent: normalizeVat(vat),
      quantity: 0,
    },
  })
}

/** Adds quantity to a specific warehouse lot (resolving/creating it first). */
export async function addWarehouseLotQty(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
  contractorId: string | null,
  price: number | string,
  vat: number | string,
  qty: number,
) {
  if (!Number.isFinite(qty)) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректна кількість' })
  }
  if (qty <= EPS) return
  const lot = await resolveWarehouseLot(tx, warehouseId, productId, contractorId, price, vat)
  await tx.warehouseStock.update({
    where: { id: lot.id },
    data: { quantity: Number(lot.quantity) + qty },
  })
}

/**
 * Decrements quantity from a specific warehouse lot. Throws if the lot is missing or has
 * insufficient quantity. Deletes the lot row when it reaches ~0.
 */
export async function decWarehouseLotQty(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
  contractorId: string | null,
  price: number | string,
  qty: number,
) {
  if (!Number.isFinite(qty)) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректна кількість' })
  }
  if (qty <= EPS) return

  const pricePerUnit = normalizePrice(price)
  const lot = await tx.warehouseStock.findFirst({
    where: { warehouseId, productId, contractorId: contractorId ?? null, pricePerUnit },
  })
  if (!lot || Number(lot.quantity) + EPS < qty) {
    throw createError({ statusCode: 400, statusMessage: 'Недостатньо товару у вибраному лоті на складі' })
  }

  const next = Number(lot.quantity) - qty
  if (next <= EPS) {
    await tx.warehouseStock.delete({ where: { id: lot.id } })
  } else {
    await tx.warehouseStock.update({ where: { id: lot.id }, data: { quantity: next } })
  }
}

/** Sum of all lot quantities for a (warehouse, product) pair. */
export async function sumWarehouseQty(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
): Promise<number> {
  const agg = await tx.warehouseStock.aggregate({
    where: { warehouseId, productId },
    _sum: { quantity: true },
  })
  return Number(agg._sum.quantity ?? 0)
}

/**
 * Consumes `qty` from warehouse lots oldest-first (FIFO) and returns the slices taken,
 * each carrying the exact cost dimensions of the lot it came from. Used for any decrement
 * that cannot identify a cost lot manually (e.g. OUTGOING invoices). Throws if the total
 * available quantity across all lots is insufficient.
 *
 * FIFO order uses the lot `id` (cuid is timestamp-prefixed and stable across updates),
 * which is a better proxy for creation order than `updatedAt` (which changes on every write).
 */
export async function consumeWarehouseFifo(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
  qty: number,
): Promise<LotSlice[]> {
  if (!Number.isFinite(qty)) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректна кількість' })
  }
  if (qty <= EPS) return []

  const lots = await tx.warehouseStock.findMany({
    where: { warehouseId, productId },
    orderBy: { id: 'asc' },
  })

  const total = lots.reduce((sum, lot) => sum + Number(lot.quantity), 0)
  if (total + EPS < qty) {
    const product = await tx.product.findUnique({ where: { id: productId } })
    throw createError({
      statusCode: 400,
      statusMessage: `Недостатньо товару "${product?.name ?? ''}" на складі. Доступно: ${Math.max(0, total)}`,
    })
  }

  const slices: LotSlice[] = []
  let remaining = qty

  for (const lot of lots) {
    if (remaining <= EPS) break
    const available = Number(lot.quantity)
    if (available <= EPS) continue

    const take = Math.min(available, remaining)
    slices.push({
      contractorId: lot.contractorId,
      pricePerUnit: Number(lot.pricePerUnit),
      vatPercent: Number(lot.vatPercent),
      quantity: take,
    })

    const next = available - take
    if (next <= EPS) {
      await tx.warehouseStock.delete({ where: { id: lot.id } })
    } else {
      await tx.warehouseStock.update({ where: { id: lot.id }, data: { quantity: next } })
    }
    remaining -= take
  }

  return slices
}

// ---------------------------------------------------------------------------
// Object lots
// ---------------------------------------------------------------------------

/**
 * Finds the object lot matching (object, product, contractor, price), creating it with
 * zero quantity if it does not exist yet. `vatPercent` is written only on creation.
 */
export async function resolveObjectLot(
  tx: Prisma.TransactionClient,
  objectId: string,
  productId: string,
  contractorId: string | null,
  price: number | string,
  vat: number | string,
) {
  const pricePerUnit = normalizePrice(price)
  const existing = await tx.objectStock.findFirst({
    where: { objectId, productId, contractorId: contractorId ?? null, pricePerUnit },
  })
  if (existing) return existing

  return tx.objectStock.create({
    data: {
      objectId,
      productId,
      contractorId: contractorId ?? null,
      pricePerUnit,
      vatPercent: normalizeVat(vat),
      quantity: 0,
    },
  })
}

/** Adds quantity to a specific object lot (resolving/creating it first). */
export async function addObjectLotQty(
  tx: Prisma.TransactionClient,
  objectId: string,
  productId: string,
  contractorId: string | null,
  price: number | string,
  vat: number | string,
  qty: number,
) {
  if (!Number.isFinite(qty)) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректна кількість' })
  }
  if (qty <= EPS) return
  const lot = await resolveObjectLot(tx, objectId, productId, contractorId, price, vat)
  await tx.objectStock.update({
    where: { id: lot.id },
    data: { quantity: Number(lot.quantity) + qty },
  })
}

/**
 * Decrements quantity from a specific object lot. Throws if the lot is missing or has
 * insufficient quantity. Deletes the lot row when it reaches ~0.
 */
export async function decObjectLotQty(
  tx: Prisma.TransactionClient,
  objectId: string,
  productId: string,
  contractorId: string | null,
  price: number | string,
  qty: number,
) {
  if (!Number.isFinite(qty)) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректна кількість' })
  }
  if (qty <= EPS) return

  const pricePerUnit = normalizePrice(price)
  const lot = await tx.objectStock.findFirst({
    where: { objectId, productId, contractorId: contractorId ?? null, pricePerUnit },
  })
  if (!lot || Number(lot.quantity) + EPS < qty) {
    throw createError({ statusCode: 400, statusMessage: 'Недостатньо товару у вибраному лоті на обʼєкті' })
  }

  const next = Number(lot.quantity) - qty
  if (next <= EPS) {
    await tx.objectStock.delete({ where: { id: lot.id } })
  } else {
    await tx.objectStock.update({ where: { id: lot.id }, data: { quantity: next } })
  }
}

/** Sum of all lot quantities for an (object, product) pair. */
export async function sumObjectQty(
  tx: Prisma.TransactionClient,
  objectId: string,
  productId: string,
): Promise<number> {
  const agg = await tx.objectStock.aggregate({
    where: { objectId, productId },
    _sum: { quantity: true },
  })
  return Number(agg._sum.quantity ?? 0)
}

/**
 * Consumes `qty` from object lots oldest-first (FIFO) and returns the slices taken,
 * each carrying the exact cost dimensions of the lot it came from. Used for any decrement
 * that cannot identify a cost lot manually (e.g. OUTGOING invoices located on an object).
 * Throws if the total available quantity across all lots is insufficient.
 */
export async function consumeObjectFifo(
  tx: Prisma.TransactionClient,
  objectId: string,
  productId: string,
  qty: number,
): Promise<LotSlice[]> {
  if (!Number.isFinite(qty)) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректна кількість' })
  }
  if (qty <= EPS) return []

  const lots = await tx.objectStock.findMany({
    where: { objectId, productId },
    orderBy: { id: 'asc' },
  })

  const total = lots.reduce((sum, lot) => sum + Number(lot.quantity), 0)
  if (total + EPS < qty) {
    const product = await tx.product.findUnique({ where: { id: productId } })
    throw createError({
      statusCode: 400,
      statusMessage: `Недостатньо товару "${product?.name ?? ''}" на обʼєкті. Доступно: ${Math.max(0, total)}`,
    })
  }

  const slices: LotSlice[] = []
  let remaining = qty

  for (const lot of lots) {
    if (remaining <= EPS) break
    const available = Number(lot.quantity)
    if (available <= EPS) continue

    const take = Math.min(available, remaining)
    slices.push({
      contractorId: lot.contractorId,
      pricePerUnit: Number(lot.pricePerUnit),
      vatPercent: Number(lot.vatPercent),
      quantity: take,
    })

    const next = available - take
    if (next <= EPS) {
      await tx.objectStock.delete({ where: { id: lot.id } })
    } else {
      await tx.objectStock.update({ where: { id: lot.id }, data: { quantity: next } })
    }
    remaining -= take
  }

  return slices
}
