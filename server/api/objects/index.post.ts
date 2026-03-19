
import type { ObjectStatus } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { name, address, description, status } = body

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })

  const object = await prisma.constructionObject.create({
    data: { name, address, description, status: (status as ObjectStatus) || 'ACTIVE' },
  })

  return { object }
})
