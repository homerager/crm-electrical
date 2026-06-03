import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  await requirePermission(event, 'products.edit')

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, description, sku, barcode, unit, groupId } = body

  const before = await prisma.product.findUnique({ where: { id } })

  const product = await prisma.product.update({
    where: { id },
    data: { name, description, sku: sku || null, barcode: barcode || null, unit, groupId: groupId || null },
    include: { group: true },
  })

  if (before) {
    const diff = computeChanges(before as unknown as Record<string, unknown>, product as unknown as Record<string, unknown>)
    if (diff) writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'UPDATE', entityType: 'Product', entityId: id, changes: diff })
  }

  return { product }
})
