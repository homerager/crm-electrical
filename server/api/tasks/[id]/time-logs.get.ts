export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!

  const timeLogs = await prisma.timeLog.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })

  const totalHours = timeLogs.reduce((sum, l) => sum + l.hours, 0)

  return { timeLogs, totalHours }
})
