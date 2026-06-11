import { requirePermission } from '../../utils/authz'
import { writeAuditLog } from '../../utils/auditLog'

interface Body {
  name: string
  description?: string
  objectId: string
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalPanels.create')

  const body = await readBody<Body>(event)
  if (!body.name?.trim() || !body.objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть назву та обʼєкт' })
  }

  const object = await prisma.constructionObject.findUnique({ where: { id: body.objectId } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  const panel = await prisma.electricalPanel.create({
    data: {
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
    entityType: 'ElectricalPanel',
    entityId: panel.id,
    changes: { name: panel.name, objectId: body.objectId },
  })

  return { panel }
})
