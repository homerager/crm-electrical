import { createError } from 'h3'
import { prisma } from './prisma'

/** Перевіряє завдання/обʼєкт для ручного запису часу (створення та оновлення). */
export async function resolveManualTimeLogTaskAndObject(params: {
  taskId?: string | null
  objectId?: string | null
}): Promise<{ taskId: string | null; objectId: string | null }> {
  let resolvedTaskId = params.taskId?.trim() || null
  let resolvedObjectId = params.objectId?.trim() || null

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
    else if (!resolvedObjectId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'У завдання немає обʼєкта — оберіть обʼєкт вручну',
      })
    }
    else {
      const obj = await prisma.constructionObject.findUnique({ where: { id: resolvedObjectId } })
      if (!obj) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })
    }
  }
  else {
    if (!resolvedObjectId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Оберіть обʼєкт або завдання',
      })
    }
    const obj = await prisma.constructionObject.findUnique({ where: { id: resolvedObjectId } })
    if (!obj) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })
  }

  return { taskId: resolvedTaskId, objectId: resolvedObjectId }
}
