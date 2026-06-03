import type { ObjectStatus } from '@prisma/client'
import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  await requirePermission(event, 'objects.edit')

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, address, description, status, budget, markupPercent, clientVatPercent, clientId, projectId } = body

  const before = await prisma.constructionObject.findUnique({ where: { id } })

  const newProjectId = projectId !== undefined ? (projectId || null) : undefined

  const object = await prisma.constructionObject.update({
    where: { id },
    data: {
      name,
      address,
      description,
      status: status as ObjectStatus,
      budget: budget != null && budget !== '' ? Number(budget) : null,
      markupPercent: markupPercent != null && markupPercent !== '' ? Number(markupPercent) : null,
      clientVatPercent: clientVatPercent != null && clientVatPercent !== '' ? Number(clientVatPercent) : null,
      clientId: clientId || null,
      ...(newProjectId !== undefined && { projectId: newProjectId }),
    },
    include: { client: true, project: { select: { id: true, name: true, color: true } } },
  })

  if (newProjectId !== undefined && before && before.projectId !== newProjectId) {
    await prisma.task.updateMany({
      where: { objectId: id },
      data: { projectId: newProjectId },
    })
  }

  if (before) {
    const diff = computeChanges(before as unknown as Record<string, unknown>, object as unknown as Record<string, unknown>)
    if (diff) writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'UPDATE', entityType: 'ConstructionObject', entityId: id, changes: diff })
  }

  return { object }
})
