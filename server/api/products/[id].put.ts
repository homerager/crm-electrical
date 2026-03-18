import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, description, sku, unit } = body

  const product = await prisma.product.update({
    where: { id },
    data: { name, description, sku: sku || null, unit },
  })

  return { product }
})
