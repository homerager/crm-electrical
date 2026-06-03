import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  await requirePermission(event, 'clients.delete')

  const id = getRouterParam(event, 'id')!

  const client = await prisma.client.findUnique({ where: { id } })
  await prisma.client.delete({ where: { id } })

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'DELETE', entityType: 'Client', entityId: id, changes: { name: client?.name } })

  return { ok: true }
})
