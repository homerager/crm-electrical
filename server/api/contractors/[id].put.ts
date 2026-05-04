import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, contactPerson, phone, email, address, notes } = body

  const contractor = await prisma.contractor.update({
    where: { id },
    data: { name, contactPerson, phone, email, address, notes },
  })

  return { contractor }
})
