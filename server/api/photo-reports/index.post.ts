import { writeAuditLog } from '../../utils/auditLog'

interface Body {
  title: string
  description?: string
  objectId: string
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const body = await readBody<Body>(event)
  if (!body.title || !body.objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть title та objectId' })
  }

  const object = await prisma.constructionObject.findUnique({ where: { id: body.objectId } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Об\'єкт не знайдено' })

  const report = await prisma.photoReport.create({
    data: {
      title: body.title,
      description: body.description || null,
      objectId: body.objectId,
      createdById: auth.userId,
    },
    include: {
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { photos: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.userName,
    action: 'CREATE',
    entityType: 'PhotoReport',
    entityId: report.id,
    changes: { title: body.title, objectId: body.objectId },
  })

  return { report }
})
