import type { ObjectStatus } from '@prisma/client'
import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, address, description, status, budget, clientId } = body

  const before = await prisma.constructionObject.findUnique({ where: { id } })

  const object = await prisma.constructionObject.update({
    where: { id },
    data: {
      name,
      address,
      description,
      status: status as ObjectStatus,
      budget: budget != null && budget !== '' ? Number(budget) : null,
      clientId: clientId || null,
    },
  })

  if (before) {
    const diff = computeChanges(before as unknown as Record<string, unknown>, object as unknown as Record<string, unknown>)
    if (diff) writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'UPDATE', entityType: 'ConstructionObject', entityId: id, changes: diff })
  }

  return { object }
})
