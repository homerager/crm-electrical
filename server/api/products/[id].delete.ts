import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  const product = await prisma.product.findUnique({ where: { id } })
  await prisma.product.delete({ where: { id } })

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'DELETE', entityType: 'Product', entityId: id, changes: { name: product?.name } })

  return { ok: true }
})
