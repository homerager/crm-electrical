import { getPdfMake, pdfFooter, defaultDocStyles, pdfTableLayout, fmtMoney, fmtQty } from './pdfBase'

interface MaterialForPdf {
  name: string
  unit: string
  quantity: number
  pricePerUnit: number
  writtenOff: boolean
  contractorName: string | null
  note: string | null
  invoiceLabel?: string | null
}

export interface InstallationWorkPdfInput {
  type: string
  name: string
  description: string | null
  objectName: string
  objectAddress: string | null
  clientName: string | null
  createdByName: string
  createdAt: Date | string
  materials: MaterialForPdf[]
}

export async function buildInstallationWorkPdf(input: InstallationWorkPdfInput): Promise<Buffer> {
  const pdfMake = getPdfMake()
  const dateStr = new Date(input.createdAt).toLocaleDateString('uk-UA')

  const content: Record<string, unknown>[] = [
    { text: 'СПЕЦИФІКАЦІЯ МАТЕРІАЛІВ', style: 'title', alignment: 'center' },
    { text: `${input.type}: ${input.name}`, style: 'subtitle', alignment: 'center', margin: [0, 4, 0, 16] },
  ]

  const infoLines: Record<string, unknown>[] = [
    { text: [{ text: 'Вид роботи: ', bold: true }, input.type] },
    { text: [{ text: 'Обʼєкт: ', bold: true }, input.objectName] },
  ]
  if (input.objectAddress) {
    infoLines.push({ text: [{ text: 'Адреса: ', bold: true }, input.objectAddress] })
  }
  if (input.clientName) {
    infoLines.push({ text: [{ text: 'Замовник: ', bold: true }, input.clientName] })
  }
  infoLines.push({ text: [{ text: 'Дата: ', bold: true }, dateStr] })
  infoLines.push({ text: [{ text: 'Автор: ', bold: true }, input.createdByName] })
  content.push({ stack: infoLines, margin: [0, 0, 0, 12] })

  if (input.description) {
    content.push({ text: [{ text: 'Опис: ', bold: true }, input.description], margin: [0, 0, 0, 8] })
  }

  const header = [
    { text: '№', style: 'th', alignment: 'center' },
    { text: 'Найменування матеріалу', style: 'th' },
    { text: 'Од.', style: 'th', alignment: 'center' },
    { text: 'К-сть', style: 'th', alignment: 'right' },
    { text: 'Ціна, ₴', style: 'th', alignment: 'right' },
    { text: 'Сума, ₴', style: 'th', alignment: 'right' },
  ]

  let total = 0
  const body = input.materials.map((m, i) => {
    const sum = m.quantity * m.pricePerUnit
    total += sum
    const nameStack: Record<string, unknown>[] = [{ text: m.name }]
    if (m.contractorName) {
      nameStack.push({ text: m.contractorName, fontSize: 7, color: '#888888' })
    }
    if (m.invoiceLabel) {
      nameStack.push({ text: m.invoiceLabel, fontSize: 7, color: '#888888' })
    }
    if (m.note) {
      nameStack.push({ text: m.note, fontSize: 7, color: '#888888', italics: true })
    }
    return [
      { text: String(i + 1), alignment: 'center' },
      { stack: nameStack },
      { text: m.unit, alignment: 'center' },
      { text: fmtQty(m.quantity), alignment: 'right' },
      { text: m.pricePerUnit > 0 ? fmtMoney(m.pricePerUnit) : '—', alignment: 'right' },
      { text: m.pricePerUnit > 0 ? fmtMoney(sum) : '—', alignment: 'right' },
    ]
  })

  if (input.materials.length === 0) {
    content.push({
      text: 'Матеріали ще не додані.',
      italics: true,
      color: '#999999',
      margin: [0, 20, 0, 0],
      alignment: 'center',
    })
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: [22, '*', 34, 50, 60, 70],
        body: [header, ...body],
      },
      layout: pdfTableLayout,
    })
    content.push({
      text: [
        { text: 'Разом за матеріалами: ', bold: true },
        { text: `₴ ${fmtMoney(Math.round(total * 100) / 100)}`, bold: true },
      ],
      alignment: 'right',
      margin: [0, 10, 0, 0],
    })
  }

  return pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    info: { title: `${input.type}: ${input.name}` },
    styles: defaultDocStyles,
    content,
    footer: pdfFooter,
  }).getBuffer()
}
