
import type { MovementType, Prisma } from '@prisma/client'

interface MovementItemInput {
  productId: string
  quantity: number
}

function parsePositiveQty(raw: unknown): number {
  const q = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(q) || q <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість має бути більшою за 0' })
  }
  return q
}

async function addWarehouseStock(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
  qty: number,
) {
  const stock = await tx.warehouseStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  })
  if (stock) {
    await tx.warehouseStock.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { quantity: Number(stock.quantity) + qty },
    })
  } else {
    await tx.warehouseStock.create({ data: { productId, warehouseId, quantity: qty } })
  }
}

async function addObjectStock(tx: Prisma.TransactionClient, objectId: string, productId: string, qty: number) {
  const row = await tx.objectStock.findUnique({
    where: { objectId_productId: { objectId, productId } },
  })
  if (row) {
    await tx.objectStock.update({
      where: { objectId_productId: { objectId, productId } },
      data: { quantity: Number(row.quantity) + qty },
    })
  } else {
    await tx.objectStock.create({ data: { objectId, productId, quantity: qty } })
  }
}

async function removeFromObjectStock(tx: Prisma.TransactionClient, objectId: string, productId: string, qty: number) {
  const row = await tx.objectStock.findUnique({
    where: { objectId_productId: { objectId, productId } },
  })
  const available = row ? Number(row.quantity) : 0
  if (available + 1e-9 < qty) {
    const product = await tx.product.findUnique({ where: { id: productId } })
    throw createError({
      statusCode: 400,
      statusMessage: `Недостатньо товару "${product?.name}" на обʼєкті. Доступно: ${available}`,
    })
  }
  const next = available - qty
  if (next <= 1e-9) {
    await tx.objectStock.delete({ where: { objectId_productId: { objectId, productId } } })
  } else {
    await tx.objectStock.update({
      where: { objectId_productId: { objectId, productId } },
      data: { quantity: next },
    })
  }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const body = await readBody(event)
  const { type, fromWarehouseId, toWarehouseId, objectId, date, notes, items } = body

  if (!type || !date || !items?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Заповніть всі обовʼязкові поля' })
  }

  const normalizedItems = (items as MovementItemInput[]).map((i) => ({
    productId: i.productId,
    quantity: parsePositiveQty(i.quantity),
  }))

  if (type === 'WAREHOUSE_TO_WAREHOUSE' || type === 'WAREHOUSE_TO_OBJECT') {
    if (!fromWarehouseId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть склад відправлення' })
    }
    if (type === 'WAREHOUSE_TO_WAREHOUSE' && !toWarehouseId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть склад призначення' })
    }
    if (type === 'WAREHOUSE_TO_OBJECT' && !objectId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт призначення' })
    }

    const movement = await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        const stock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: fromWarehouseId } },
        })

        const available = stock ? Number(stock.quantity) : 0
        if (available < item.quantity) {
          const product = await tx.product.findUnique({ where: { id: item.productId } })
          throw createError({
            statusCode: 400,
            statusMessage: `Недостатньо товару "${product?.name}" на складі. Доступно: ${available}`,
          })
        }

        await tx.warehouseStock.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: fromWarehouseId } },
          data: { quantity: available - item.quantity },
        })

        if (type === 'WAREHOUSE_TO_WAREHOUSE' && toWarehouseId) {
          await addWarehouseStock(tx, toWarehouseId, item.productId, item.quantity)
        }

        if (type === 'WAREHOUSE_TO_OBJECT' && objectId) {
          await addObjectStock(tx, objectId, item.productId, item.quantity)
        }
      }

      return tx.movement.create({
        data: {
          type: type as MovementType,
          fromWarehouseId,
          toWarehouseId: type === 'WAREHOUSE_TO_WAREHOUSE' ? toWarehouseId : null,
          objectId: type === 'WAREHOUSE_TO_OBJECT' ? objectId : null,
          createdById: auth.userId,
          date: new Date(date),
          notes,
          items: {
            create: normalizedItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      })
    })

    return { movement }
  }

  if (type === 'OBJECT_WRITE_OFF') {
    if (!objectId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт' })
    }

    const movement = await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        await removeFromObjectStock(tx, objectId, item.productId, item.quantity)
      }

      return tx.movement.create({
        data: {
          type: 'OBJECT_WRITE_OFF',
          fromWarehouseId: null,
          toWarehouseId: null,
          objectId,
          createdById: auth.userId,
          date: new Date(date),
          notes,
          items: {
            create: normalizedItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      })
    })

    return { movement }
  }

  if (type === 'OBJECT_TO_WAREHOUSE') {
    if (!objectId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт' })
    }
    if (!toWarehouseId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть склад для повернення' })
    }

    const movement = await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        await removeFromObjectStock(tx, objectId, item.productId, item.quantity)
        await addWarehouseStock(tx, toWarehouseId, item.productId, item.quantity)
      }

      return tx.movement.create({
        data: {
          type: 'OBJECT_TO_WAREHOUSE',
          fromWarehouseId: null,
          toWarehouseId,
          objectId,
          createdById: auth.userId,
          date: new Date(date),
          notes,
          items: {
            create: normalizedItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      })
    })

    return { movement }
  }

  throw createError({ statusCode: 400, statusMessage: 'Невідомий тип переміщення' })
})
