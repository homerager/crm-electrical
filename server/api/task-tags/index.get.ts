export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const tags = await prisma.taskTag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { tasks: true } } },
  })

  return { tags }
})
