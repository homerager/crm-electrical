import { prisma } from '~/server/utils/prisma'
import type { MovementType } from '@prisma/client'

interface MovementItemInput {
  productId: string
  quantity: number
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const body = await readBody(event)
  const { type, fromWarehouseId, toWarehouseId, objectId, date, notes, items } = body

  if (!type || !fromWarehouseId || !date || !items?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Заповніть всі обовʼязкові поля' })
  }

  if (type === 'WAREHOUSE_TO_WAREHOUSE' && !toWarehouseId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть склад призначення' })
  }

  if (type === 'WAREHOUSE_TO_OBJECT' && !objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт призначення' })
  }

  const movement = await prisma.$transaction(async (tx) => {
    for (const item of items as MovementItemInput[]) {
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
        const toStock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: toWarehouseId } },
        })

        if (toStock) {
          await tx.warehouseStock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: toWarehouseId } },
            data: { quantity: Number(toStock.quantity) + item.quantity },
          })
        } else {
          await tx.warehouseStock.create({
            data: { productId: item.productId, warehouseId: toWarehouseId, quantity: item.quantity },
          })
        }
      }
    }

    return tx.movement.create({
      data: {
        type: type as MovementType,
        fromWarehouseId,
        toWarehouseId: toWarehouseId || null,
        objectId: objectId || null,
        createdById: auth.userId,
        date: new Date(date),
        notes,
        items: {
          create: (items as MovementItemInput[]).map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    })
  })

  return { movement }
})
