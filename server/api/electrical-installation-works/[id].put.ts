import { requirePermission } from '../../utils/authz'
import { writeAuditLog } from '../../utils/auditLog'

interface Body {
  type?: string
  name?: string
  description?: string
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalInstallationWorks.edit')

  const id = getRouterParam(event, 'id')!
  const body = await readBody<Body>(event)

  const existing = await prisma.electricalInstallationWork.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Роботу не знайдено' })

  if (body.name !== undefined && !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Назва не може бути порожньою' })
  }

  const work = await prisma.electricalInstallationWork.update({
    where: { id },
    data: {
      ...(body.type !== undefined ? { type: body.type.trim() || 'Електрощит' } : {}),
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
    },
    include: {
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'ElectricalInstallationWork',
    entityId: work.id,
    changes: { type: work.type, name: work.name },
  })

  return { work }
})
