import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { name, address, description } = body

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })

  const warehouse = await prisma.warehouse.create({
    data: { name, address, description },
  })

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'CREATE', entityType: 'Warehouse', entityId: warehouse.id, changes: { name, address, description } })

  return { warehouse }
})
