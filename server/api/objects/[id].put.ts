import { prisma } from '~/server/utils/prisma'
import type { ObjectStatus } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, address, description, status } = body

  const object = await prisma.constructionObject.update({
    where: { id },
    data: { name, address, description, status: status as ObjectStatus },
  })

  return { object }
})
