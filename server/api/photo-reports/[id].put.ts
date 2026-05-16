import { isElevatedRole } from '../../utils/authz'
import { writeAuditLog, computeChanges } from '../../utils/auditLog'

interface Body {
  title?: string
  description?: string | null
  objectId?: string
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!
  const body = await readBody<Body>(event)

  const existing = await prisma.photoReport.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Фото-звіт не знайдено' })

  if (!isElevatedRole(auth.role) && existing.createdById !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  if (body.objectId) {
    const obj = await prisma.constructionObject.findUnique({ where: { id: body.objectId } })
    if (!obj) throw createError({ statusCode: 404, statusMessage: 'Об\'єкт не знайдено' })
  }

  const updated = await prisma.photoReport.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.objectId !== undefined && { objectId: body.objectId }),
    },
    include: {
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      photos: { orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  const changes = computeChanges(existing as any, updated as any)
  writeAuditLog({
    userId: auth.userId,
    userName: auth.userName,
    action: 'UPDATE',
    entityType: 'PhotoReport',
    entityId: id,
    changes,
  })

  return { report: updated }
})
