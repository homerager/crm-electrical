import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  const existing = await prisma.supplierPrice.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Ціну не знайдено' })

  await prisma.supplierPrice.delete({ where: { id } })

  writeAuditLog({
    userId: auth!.userId,
    userName: auth!.name,
    action: 'DELETE',
    entityType: 'SupplierPrice',
    entityId: id,
    changes: { contractorId: existing.contractorId, productId: existing.productId, price: Number(existing.price) },
  })

  return { ok: true }
})
