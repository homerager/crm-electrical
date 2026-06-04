import { unlink } from 'node:fs/promises'
import { can } from '../../utils/authz'
import { getPhotoFilePath } from '../../utils/photoReportFile'
import { writeAuditLog } from '../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const report = await prisma.photoReport.findUnique({
    where: { id },
    include: { photos: { select: { storedAs: true } } },
  })
  if (!report) throw createError({ statusCode: 404, statusMessage: 'Фото-звіт не знайдено' })

  if (!(await can(event, 'photoReports.manage')) && report.createdById !== auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  for (const photo of report.photos) {
    try { await unlink(getPhotoFilePath(photo.storedAs)) } catch { /* ignore */ }
  }

  await prisma.photoReport.delete({ where: { id } })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'PhotoReport',
    entityId: id,
    changes: { title: report.title },
  })

  return { ok: true }
})
