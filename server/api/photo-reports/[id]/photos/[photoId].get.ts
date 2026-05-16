import { createReadStream, existsSync } from 'node:fs'
import { sendStream, setResponseHeader } from 'h3'
import { getPhotoFilePath } from '../../../../utils/photoReportFile'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const reportId = getRouterParam(event, 'id')!
  const photoId = getRouterParam(event, 'photoId')!

  const photo = await prisma.photoReportPhoto.findFirst({
    where: { id: photoId, reportId },
  })
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Фото не знайдено' })

  const filePath = getPhotoFilePath(photo.storedAs)
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Файл втрачено на диску' })
  }

  setResponseHeader(event, 'content-type', photo.mimeType)
  setResponseHeader(
    event,
    'content-disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(photo.filename)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, max-age=86400')

  return sendStream(event, createReadStream(filePath))
})
