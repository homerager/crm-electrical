import type { ObjectStatus } from '@prisma/client'
import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  await requirePermission(event, 'objects.create')

  const body = await readBody(event)
  const { name, address, description, status, budget, markupPercent, clientVatPercent, clientId, projectId } = body

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })

  const object = await prisma.constructionObject.create({
    data: {
      name,
      address,
      description,
      status: (status as ObjectStatus) || 'ACTIVE',
      budget: budget != null && budget !== '' ? Number(budget) : null,
      markupPercent: markupPercent != null && markupPercent !== '' ? Number(markupPercent) : null,
      clientVatPercent: clientVatPercent != null && clientVatPercent !== '' ? Number(clientVatPercent) : null,
      clientId: clientId || null,
      projectId: projectId || null,
    },
    include: { client: true, project: { select: { id: true, name: true, color: true } } },
  })

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'CREATE', entityType: 'ConstructionObject', entityId: object.id, changes: { name, address, description, status: object.status, budget: object.budget, markupPercent: object.markupPercent } })

  return { object }
})
