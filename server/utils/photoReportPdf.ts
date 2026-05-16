import { getPdfMake, pdfFooter, defaultDocStyles } from './pdfBase'
import { readPhotoBuffer } from './photoReportFile'

const STAGE_LABELS: Record<string, string> = {
  BEFORE: 'До початку робіт',
  IN_PROGRESS: 'В процесі виконання',
  AFTER: 'Після завершення робіт',
}

const STAGE_ORDER = ['BEFORE', 'IN_PROGRESS', 'AFTER']

interface PhotoForPdf {
  storedAs: string
  mimeType: string
  stage: string
  description: string | null
  takenAt: Date | string | null
  latitude: number | null
  longitude: number | null
}

export interface PhotoReportPdfInput {
  title: string
  description: string | null
  objectName: string
  objectAddress: string | null
  clientName: string | null
  createdByName: string
  createdAt: Date | string
  photos: PhotoForPdf[]
}

function mimeToDataUriPrefix(mime: string): string {
  if (mime === 'image/png') return 'data:image/png;base64,'
  if (mime === 'image/webp') return 'data:image/webp;base64,'
  if (mime === 'image/gif') return 'data:image/gif;base64,'
  return 'data:image/jpeg;base64,'
}

export async function buildPhotoReportPdf(input: PhotoReportPdfInput): Promise<Buffer> {
  const pdfMake = getPdfMake()
  const dateStr = new Date(input.createdAt).toLocaleDateString('uk-UA')

  const content: Record<string, unknown>[] = [
    { text: 'ФОТО-ЗВІТ', style: 'title', alignment: 'center' },
    { text: input.title, style: 'subtitle', alignment: 'center', margin: [0, 4, 0, 16] },
  ]

  const infoLines: Record<string, unknown>[] = [
    { text: [{ text: 'Об\'єкт: ', bold: true }, input.objectName] },
  ]
  if (input.objectAddress) {
    infoLines.push({ text: [{ text: 'Адреса: ', bold: true }, input.objectAddress] })
  }
  if (input.clientName) {
    infoLines.push({ text: [{ text: 'Замовник: ', bold: true }, input.clientName] })
  }
  infoLines.push({ text: [{ text: 'Дата звіту: ', bold: true }, dateStr] })
  infoLines.push({ text: [{ text: 'Автор: ', bold: true }, input.createdByName] })
  content.push({ stack: infoLines, margin: [0, 0, 0, 12] })

  if (input.description) {
    content.push({ text: [{ text: 'Опис: ', bold: true }, input.description], margin: [0, 0, 0, 8] })
  }

  const grouped = new Map<string, PhotoForPdf[]>()
  for (const stage of STAGE_ORDER) {
    const stagePhotos = input.photos.filter(p => p.stage === stage)
    if (stagePhotos.length > 0) {
      grouped.set(stage, stagePhotos)
    }
  }

  let sectionNum = 1
  for (const [stage, photos] of grouped) {
    content.push({
      text: `${sectionNum}. ${STAGE_LABELS[stage] || stage}`,
      style: 'sectionHeader',
      pageBreak: sectionNum > 1 ? 'before' : undefined,
    })

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      let imageDataUri: string | null = null

      try {
        const buf = await readPhotoBuffer(photo.storedAs)
        imageDataUri = mimeToDataUriPrefix(photo.mimeType) + buf.toString('base64')
      } catch {
        // file missing — show placeholder text
      }

      if (imageDataUri) {
        content.push({
          image: imageDataUri,
          width: 480,
          alignment: 'center',
          margin: [0, 8, 0, 4],
        })
      } else {
        content.push({
          text: `[Фото ${i + 1}: файл недоступний]`,
          italics: true,
          color: '#999999',
          alignment: 'center',
          margin: [0, 8, 0, 4],
        })
      }

      const captionParts: string[] = []
      if (photo.description) captionParts.push(photo.description)
      if (photo.takenAt) {
        const d = new Date(photo.takenAt)
        captionParts.push(`Дата зйомки: ${d.toLocaleDateString('uk-UA')} ${d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`)
      }
      if (photo.latitude != null && photo.longitude != null) {
        captionParts.push(`GPS: ${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`)
      }

      if (captionParts.length > 0) {
        content.push({
          text: captionParts.join(' | '),
          fontSize: 8,
          color: '#666666',
          alignment: 'center',
          margin: [0, 0, 0, 12],
        })
      }
    }

    sectionNum++
  }

  if (input.photos.length === 0) {
    content.push({
      text: 'Фотографії відсутні.',
      italics: true,
      color: '#999999',
      margin: [0, 20, 0, 0],
      alignment: 'center',
    })
  }

  return pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    info: { title: `Фото-звіт: ${input.title}` },
    styles: defaultDocStyles,
    content,
    footer: pdfFooter,
  }).getBuffer()
}
