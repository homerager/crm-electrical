export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const jobTitles = await prisma.jobTitle.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return { jobTitles }
})
