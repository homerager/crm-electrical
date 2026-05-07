import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, address, description, isActive } = body

  const before = await prisma.warehouse.findUnique({ where: { id } })

  const warehouse = await prisma.warehouse.update({
    where: { id },
    data: { name, address, description, isActive },
  })

  if (before) {
    const diff = computeChanges(before as unknown as Record<string, unknown>, warehouse as unknown as Record<string, unknown>)
    if (diff) writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'UPDATE', entityType: 'Warehouse', entityId: id, changes: diff })
  }

  return { warehouse }
})
