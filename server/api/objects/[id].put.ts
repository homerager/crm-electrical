import type { ObjectStatus } from '@prisma/client'
import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, address, description, status, budget } = body

  const object = await prisma.constructionObject.update({
    where: { id },
    data: {
      name,
      address,
      description,
      status: status as ObjectStatus,
      budget: budget != null && budget !== '' ? Number(budget) : null,
    },
  })

  return { object }
})
