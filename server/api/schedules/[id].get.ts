export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, jobTitle: { select: { name: true } } } },
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  if (!schedule) throw createError({ statusCode: 404, statusMessage: 'Запис розкладу не знайдено' })

  return schedule
})
