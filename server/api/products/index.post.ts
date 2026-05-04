import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { name, description, sku, unit, groupId } = body

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })

  const product = await prisma.product.create({
    data: { name, description, sku: sku || null, unit: unit || 'шт', groupId: groupId || null },
    include: { group: true },
  })

  return { product }
})
