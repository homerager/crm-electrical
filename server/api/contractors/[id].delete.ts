import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  const contractor = await prisma.contractor.findUnique({ where: { id } })
  await prisma.contractor.delete({ where: { id } })

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'DELETE', entityType: 'Contractor', entityId: id, changes: { name: contractor?.name } })

  return { ok: true }
})
