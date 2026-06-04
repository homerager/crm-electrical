import { unlink } from 'node:fs/promises'
import { can } from '../../../../utils/authz'
import { getPhotoFilePath } from '../../../../utils/photoReportFile'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const reportId = getRouterParam(event, 'id')!
  const photoId = getRouterParam(event, 'photoId')!

  const photo = await prisma.photoReportPhoto.findFirst({
    where: { id: photoId, reportId },
    include: { report: { select: { createdById: true } } },
  })
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Фото не знайдено' })

  if (!(await can(event, 'photoReports.manage')) && photo.report.createdById !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  try { await unlink(getPhotoFilePath(photo.storedAs)) } catch { /* ignore */ }

  await prisma.photoReportPhoto.delete({ where: { id: photoId } })

  return { ok: true }
})
