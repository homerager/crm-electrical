import {
  MAX_PHOTO_FILE_SIZE,
  buildPhotoStoredName,
  writePhotoBuffer,
  parseBasicExif,
} from '../../../utils/photoReportFile'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const reportId = getRouterParam(event, 'id')!

  const report = await prisma.photoReport.findUnique({ where: { id: reportId } })
  if (!report) throw createError({ statusCode: 404, statusMessage: 'Фото-звіт не знайдено' })

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Файли не отримано' })
  }

  let stage = 'BEFORE'
  let description: string | null = null

  const fileBuffers: { filename: string; data: Buffer; type: string }[] = []

  for (const part of parts) {
    if (part.name === 'stage' && part.data) {
      stage = part.data.toString().toUpperCase()
    } else if (part.name === 'description' && part.data) {
      description = part.data.toString() || null
    } else if (part.filename && part.data) {
      if (part.data.length > MAX_PHOTO_FILE_SIZE) {
        throw createError({ statusCode: 413, statusMessage: `Файл "${part.filename}" перевищує ліміт 50 МБ` })
      }
      const mime = part.type ?? 'application/octet-stream'
      if (!ALLOWED_MIME.includes(mime)) {
        throw createError({ statusCode: 400, statusMessage: `Тип файлу "${mime}" не дозволено. Допустимо: JPEG, PNG, WebP, GIF` })
      }
      fileBuffers.push({ filename: part.filename, data: part.data, type: mime })
    }
  }

  if (!['BEFORE', 'IN_PROGRESS', 'AFTER'].includes(stage)) {
    stage = 'BEFORE'
  }

  const currentMax = await prisma.photoReportPhoto.aggregate({
    where: { reportId },
    _max: { sortOrder: true },
  })
  let nextSort = (currentMax._max.sortOrder ?? -1) + 1

  const results = []

  for (const file of fileBuffers) {
    const storedAs = buildPhotoStoredName(file.filename)
    await writePhotoBuffer(storedAs, file.data)

    const exif = file.type === 'image/jpeg' ? parseBasicExif(file.data) : { latitude: null, longitude: null, takenAt: null }

    const photo = await prisma.photoReportPhoto.create({
      data: {
        reportId,
        stage: stage as any,
        description,
        filename: file.filename,
        storedAs,
        mimeType: file.type,
        size: file.data.length,
        latitude: exif.latitude,
        longitude: exif.longitude,
        takenAt: exif.takenAt,
        sortOrder: nextSort++,
      },
    })
    results.push(photo)
  }

  return { photos: results }
})
