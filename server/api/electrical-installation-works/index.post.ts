import { requirePermission } from '../../utils/authz'
import { writeAuditLog } from '../../utils/auditLog'

interface Body {
  type?: string
  name: string
  description?: string
  objectId: string
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalInstallationWorks.create')

  const body = await readBody<Body>(event)
  if (!body.name?.trim() || !body.objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть назву та обʼєкт' })
  }

  const object = await prisma.constructionObject.findUnique({ where: { id: body.objectId } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  const work = await prisma.electricalInstallationWork.create({
    data: {
      type: body.type?.trim() || 'Електрощит',
      name: body.name.trim(),
      description: body.description?.trim() || null,
      objectId: body.objectId,
      createdById: auth.userId,
    },
    include: {
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'ElectricalInstallationWork',
    entityId: work.id,
    changes: { type: work.type, name: work.name, objectId: body.objectId },
  })

  return { work }
})
