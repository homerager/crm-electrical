import type { Prisma } from '@prisma/client'

const EPS = 1e-9

export async function sumReservedOnWarehouse(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
): Promise<number> {
  const agg = await tx.warehouseObjectReservation.aggregate({
    where: { warehouseId, productId },
    _sum: { quantity: true },
  })
  return Number(agg._sum.quantity ?? 0)
}

export async function getReservationRowQty(
  tx: Prisma.TransactionClient,
  objectId: string,
  warehouseId: string,
  productId: string,
): Promise<number> {
  const row = await tx.warehouseObjectReservation.findUnique({
    where: { objectId_warehouseId_productId: { objectId, warehouseId, productId } },
  })
  return row ? Number(row.quantity) : 0
}

/** Вільна кількість на складі (фізичний залишок мінус усі резерви по цьому товару). */
export async function freeQtyOnWarehouse(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
): Promise<number> {
  const stock = await tx.warehouseStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  })
  const physical = stock ? Number(stock.quantity) : 0
  const reserved = await sumReservedOnWarehouse(tx, warehouseId, productId)
  return physical - reserved
}

export async function adjustReservationDelta(
  tx: Prisma.TransactionClient,
  objectId: string,
  warehouseId: string,
  productId: string,
  delta: number,
) {
  if (Math.abs(delta) < EPS) return
  if (!Number.isFinite(delta)) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректна кількість' })
  }

  const stock = await tx.warehouseStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  })
  const physical = stock ? Number(stock.quantity) : 0
  const reservedTotal = await sumReservedOnWarehouse(tx, warehouseId, productId)
  const currentForObject = await getReservationRowQty(tx, objectId, warehouseId, productId)

  if (delta > 0) {
    const free = physical - reservedTotal
    if (delta > free + EPS) {
      const product = await tx.product.findUnique({ where: { id: productId } })
      throw createError({
        statusCode: 400,
        statusMessage: `Недостатньо вільного залишку для резерву "${product?.name}". Вільно: ${Math.max(0, free)}`,
      })
    }
    const next = currentForObject + delta
    await tx.warehouseObjectReservation.upsert({
      where: { objectId_warehouseId_productId: { objectId, warehouseId, productId } },
      create: { objectId, warehouseId, productId, quantity: delta },
      update: { quantity: next },
    })
    return
  }

  const release = -delta
  if (release > currentForObject + EPS) {
    const product = await tx.product.findUnique({ where: { id: productId } })
    throw createError({
      statusCode: 400,
      statusMessage: `Неможливо зняти резерв більше ніж зарезервовано для "${product?.name ?? 'товару'}"`,
    })
  }
  const next = currentForObject - release
  if (next <= EPS) {
    await tx.warehouseObjectReservation.delete({
      where: { objectId_warehouseId_productId: { objectId, warehouseId, productId } },
    })
  } else {
    await tx.warehouseObjectReservation.update({
      where: { objectId_warehouseId_productId: { objectId, warehouseId, productId } },
      data: { quantity: next },
    })
  }
}

/** При відпуску на обʼєкт: спочатку знімається резерв цього обʼєкта на цьому складі, решта — з вільного залишку. */
export async function consumeReservationForShipment(
  tx: Prisma.TransactionClient,
  objectId: string,
  warehouseId: string,
  productId: string,
  shipmentQty: number,
) {
  const resForObject = await getReservationRowQty(tx, objectId, warehouseId, productId)
  const fromRes = Math.min(resForObject, shipmentQty)
  const fromFree = shipmentQty - fromRes

  const reservedTotal = await sumReservedOnWarehouse(tx, warehouseId, productId)
  const stock = await tx.warehouseStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  })
  const physical = stock ? Number(stock.quantity) : 0
  const freePool = physical - reservedTotal

  if (fromFree > freePool + EPS) {
    const product = await tx.product.findUnique({ where: { id: productId } })
    throw createError({
      statusCode: 400,
      statusMessage: `Недостатньо товару "${product?.name}" на складі з урахуванням резервів. Доступно для цього обʼєкта: ${resForObject + Math.max(0, freePool)}`,
    })
  }

  if (fromRes > EPS) {
    const nextRes = resForObject - fromRes
    if (nextRes <= EPS) {
      await tx.warehouseObjectReservation.delete({
        where: { objectId_warehouseId_productId: { objectId, warehouseId, productId } },
      })
    } else {
      await tx.warehouseObjectReservation.update({
        where: { objectId_warehouseId_productId: { objectId, warehouseId, productId } },
        data: { quantity: nextRes },
      })
    }
  }
}
