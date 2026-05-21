import { createError } from 'h3'
import { prisma } from './prisma'

/**
 * Перевіряє завдання / обʼєкт / склад для ручного запису часу (створення та оновлення).
 * Локація запису — або обʼєкт (опціонально із завданням), або склад. Обидва одночасно не допускаються.
 */
export async function resolveManualTimeLogRefs(params: {
  taskId?: string | null
  objectId?: string | null
  warehouseId?: string | null
}): Promise<{ taskId: string | null; objectId: string | null; warehouseId: string | null }> {
  let resolvedTaskId = params.taskId?.trim() || null
  let resolvedObjectId = params.objectId?.trim() || null
  const resolvedWarehouseId = params.warehouseId?.trim() || null

  if (resolvedWarehouseId) {
    if (resolvedTaskId || resolvedObjectId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Оберіть або обʼєкт, або склад — не обидва одночасно',
      })
    }
    const warehouse = await prisma.warehouse.findUnique({ where: { id: resolvedWarehouseId } })
    if (!warehouse) throw createError({ statusCode: 404, statusMessage: 'Склад не знайдено' })

    return { taskId: null, objectId: null, warehouseId: resolvedWarehouseId }
  }

  if (resolvedTaskId) {
    const task = await prisma.task.findUnique({ where: { id: resolvedTaskId } })
    if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

    if (resolvedObjectId && task.objectId && task.objectId !== resolvedObjectId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Обраний обʼєкт не збігається з обʼєктом завдання',
      })
    }

    if (task.objectId) {
      resolvedObjectId = task.objectId
    }
    else if (resolvedObjectId) {
      const obj = await prisma.constructionObject.findUnique({ where: { id: resolvedObjectId } })
      if (!obj) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })
    }
  }
  else if (resolvedObjectId) {
    const obj = await prisma.constructionObject.findUnique({ where: { id: resolvedObjectId } })
    if (!obj) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })
  }

  return { taskId: resolvedTaskId, objectId: resolvedObjectId, warehouseId: null }
}
