import type { ObjectStatus } from '@prisma/client'
import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
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
