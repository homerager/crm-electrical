import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  await prisma.jobTitle.delete({ where: { id } })

  return { ok: true }
})
