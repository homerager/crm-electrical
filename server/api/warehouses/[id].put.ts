import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, address, description, isActive } = body

  const warehouse = await prisma.warehouse.update({
    where: { id },
    data: { name, address, description, isActive },
  })

  return { warehouse }
})
