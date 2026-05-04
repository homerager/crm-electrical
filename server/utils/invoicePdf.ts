import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { Prisma } from '@prisma/client'

export type InvoiceForPdf = Prisma.InvoiceGetPayload<{
  include: {
    contractor: true
    warehouse: true
    createdBy: { select: { id: true; name: true } }
    items: { include: { product: true } }
  }
}>

function fmtMoney(n: number): string {
  return `${n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`
}

function fmtQty(n: number): string {
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

// pdfmake — CommonJS; підвантажуємо з кореня проєкту (стабільно для Nitro bundle).
const requireFromRoot = createRequire(join(process.cwd(), 'package.json'))

let pdfMakeSingleton: {
  createPdf: (def: Record<string, unknown>) => { getBuffer: () => Promise<Buffer> }
  virtualfs: { writeFileSync: (name: string, buf: Buffer) => void }
  fonts: Record<string, Record<string, string>>
  setUrlAccessPolicy: (fn: (url: string) => boolean) => void
} | null = null

function getPdfMake() {
  if (!pdfMakeSingleton) {
    const pdfMake = requireFromRoot('pdfmake')
    const vfs = requireFromRoot('pdfmake/build/vfs_fonts') as Record<string, string>
    pdfMake.setUrlAccessPolicy(() => false)
    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    }
    for (const key of Object.keys(vfs)) {
      pdfMake.virtualfs.writeFileSync(key, Buffer.from(vfs[key], 'base64'))
    }
    pdfMakeSingleton = pdfMake
  }
  return pdfMakeSingleton
}

export async function buildInvoicePdfBuffer(invoice: InvoiceForPdf): Promise<Buffer> {
  const pdfMake = getPdfMake()
  const typeLabel = invoice.type === 'INCOMING' ? 'Прихід' : 'Видаток'
  const dateStr = new Date(invoice.date).toLocaleDateString('uk-UA')

  const rows: Record<string, unknown>[][] = [
    [
      { text: '№', style: 'th', alignment: 'center' },
      { text: 'Товар', style: 'th' },
      { text: 'Артикул', style: 'th' },
      { text: 'К-сть', style: 'th', alignment: 'right' },
      { text: 'Ціна', style: 'th', alignment: 'right' },
      { text: 'Сума', style: 'th', alignment: 'right' },
    ],
  ]

  let total = 0
  invoice.items.forEach((line, idx) => {
    const qty = Number(line.quantity)
    const price = Number(line.pricePerUnit)
    const lineTotal = qty * price
    total += lineTotal
    rows.push([
      { text: String(idx + 1), alignment: 'center' },
      { text: line.product.name },
      { text: line.product.sku || '—' },
      { text: `${fmtQty(qty)} ${line.product.unit || ''}`.trim(), alignment: 'right' },
      { text: fmtMoney(price), alignment: 'right' },
      { text: fmtMoney(lineTotal), alignment: 'right', bold: true },
    ])
  })

  rows.push([
    { text: 'Всього:', colSpan: 5, alignment: 'right', bold: true },
    {},
    {},
    {},
    {},
    { text: fmtMoney(total), alignment: 'right', bold: true },
  ])

  const stack: Record<string, unknown>[] = [
    { text: `Накладна №${invoice.number}`, style: 'title' },
    { text: typeLabel, style: 'subtitle', margin: [0, 2, 0, 12] },
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: [{ text: 'Дата: ', bold: true }, dateStr] },
            { text: [{ text: 'Склад: ', bold: true }, invoice.warehouse.name] },
            { text: [{ text: 'Контрагент: ', bold: true }, invoice.contractor?.name || '—'] },
            { text: [{ text: 'Створив: ', bold: true }, invoice.createdBy.name] },
          ],
        },
      ],
    },
  ]

  if (invoice.notes) {
    stack.push({
      text: [{ text: 'Примітки: ', bold: true }, invoice.notes],
      margin: [0, 8, 0, 0],
    })
  }

  stack.push({
    table: {
      headerRows: 1,
      widths: [26, '*', 72, 62, 62, 72],
      dontBreakRows: true,
      body: rows,
    },
    layout: {
      fillColor: (i: number) => (i === 0 ? '#eeeeee' : null),
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 16, 0, 0],
  })

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    info: { title: `Накладна №${invoice.number}` },
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 11, color: '#444444' },
      th: { bold: true, fontSize: 9 },
    },
    content: stack,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 0, 40, 24],
      fontSize: 8,
      color: '#666666',
      text: `Стор. ${currentPage} з ${pageCount}`,
      alignment: 'center',
    }),
  }

  return pdfMake.createPdf(docDefinition).getBuffer()
}
