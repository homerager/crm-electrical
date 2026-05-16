export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const report = await prisma.photoReport.findUnique({
    where: { id },
    include: {
      object: { select: { id: true, name: true, address: true, clientId: true, client: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true } },
      photos: { orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  if (!report) throw createError({ statusCode: 404, statusMessage: 'Фото-звіт не знайдено' })

  return { report }
})
