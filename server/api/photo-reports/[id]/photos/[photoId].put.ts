interface Body {
  stage?: string
  description?: string | null
  sortOrder?: number
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const reportId = getRouterParam(event, 'id')!
  const photoId = getRouterParam(event, 'photoId')!
  const body = await readBody<Body>(event)

  const photo = await prisma.photoReportPhoto.findFirst({
    where: { id: photoId, reportId },
  })
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Фото не знайдено' })

  const data: any = {}
  if (body.stage && ['BEFORE', 'IN_PROGRESS', 'AFTER'].includes(body.stage.toUpperCase())) {
    data.stage = body.stage.toUpperCase()
  }
  if (body.description !== undefined) data.description = body.description
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

  const updated = await prisma.photoReportPhoto.update({
    where: { id: photoId },
    data,
  })

  return { photo: updated }
})
