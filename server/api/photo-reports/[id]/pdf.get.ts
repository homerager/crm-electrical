import { setResponseHeader } from 'h3'
import { buildPhotoReportPdf } from '../../../utils/photoReportPdf'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const report = await prisma.photoReport.findUnique({
    where: { id },
    include: {
      object: {
        select: {
          name: true,
          address: true,
          client: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
      photos: {
        orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!report) throw createError({ statusCode: 404, statusMessage: 'Фото-звіт не знайдено' })

  const buffer = await buildPhotoReportPdf({
    title: report.title,
    description: report.description,
    objectName: report.object.name,
    objectAddress: report.object.address,
    clientName: report.object.client?.name ?? null,
    createdByName: report.createdBy.name,
    createdAt: report.createdAt,
    photos: report.photos,
  })

  const safeTitle = report.title.replace(/[^\w\s.-]+/g, '_').trim().substring(0, 60)

  const query = getQuery(event)
  const inline = query.inline === '1' || query.inline === 'true'

  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(
    event,
    'content-disposition',
    inline
      ? `inline; filename="photo-report.pdf"; filename*=UTF-8''${encodeURIComponent(`Фото-звіт-${safeTitle}.pdf`)}`
      : `attachment; filename="photo-report.pdf"; filename*=UTF-8''${encodeURIComponent(`Фото-звіт-${safeTitle}.pdf`)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, no-cache')

  return buffer
})
