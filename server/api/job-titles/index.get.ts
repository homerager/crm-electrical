import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const jobTitles = await prisma.jobTitle.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return { jobTitles }
})
