import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPdfMake, fmtMoney, fmtQty } from './pdfBase'

let _logoBase64: string | null = null

function getLogoDataUri(): string | null {
  if (_logoBase64 !== undefined && _logoBase64 !== null) return _logoBase64
  try {
    const buf = readFileSync(join(process.cwd(), 'public/static/images/logo.png'))
    _logoBase64 = `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    _logoBase64 = null
  }
  return _logoBase64
}

export interface ProposalEquipmentCard {
  title: string
  highlight: string
  spec1?: string
  spec2?: string
}

export interface ProposalItem {
  name: string
  quantity: number
  unit: string
  pricePerUnit: number
}

export interface ProposalInput {
  title: string
  subtitle?: string
  tagline?: string
  date?: string
  usdRate?: number

  companyName?: string
  companyTagline?: string
  companyWebsite?: string
  companyPhone?: string

  equipmentCards?: ProposalEquipmentCard[]
  items: ProposalItem[]

  worksDescription?: string
  worksPercent?: number
  techSpecs?: string
}

const NAVY = '#1E3A5F'
const CARD_BG = '#F2F4F7'
const HEADER_TEXT_MUTED = '#9DB4CC'

export async function buildProposalPdf(input: ProposalInput): Promise<Buffer> {
  const pdfMake = getPdfMake()

  const companyName = input.companyName || ''
  const companyTagline = input.companyTagline || ''
  const companyWebsite = input.companyWebsite || ''
  const companyPhone = input.companyPhone || ''

  const dateStr = input.date
    ? new Date(input.date).toLocaleDateString('uk-UA')
    : new Date().toLocaleDateString('uk-UA')

  const content: Record<string, unknown>[] = []

  /* ── Header bar ── */
  const logoDataUri = getLogoDataUri()

  // Header: [лого] [назва + підзаголовок] [сайт + телефон]
  const headerBody: Record<string, unknown>[][] = [[
    // Колонка 1 — лого (або порожня якщо немає)
    logoDataUri
      ? { image: logoDataUri, height: 52, fit: [160, 52], alignment: 'left' }
      : { text: '' },
    // Колонка 2 — назва компанії + підзаголовок (поряд з лого)
    {
      stack: [
        companyName
          ? { text: companyName, color: 'white', bold: true, fontSize: 14, margin: [0, 0, 0, 3] }
          : { text: '' },
        companyWebsite
          ? { text: companyWebsite, color: 'white', fontSize: 9, alignment: 'left', margin: [0, 0, 0, 3]  }
          : { text: '' },
        companyPhone
          ? { text: companyPhone, color: 'white', fontSize: 9, bold: true, alignment: 'left',  margin: [0, 0, 0, 3]  }
          : { text: '' },
        companyTagline
          ? { text: companyTagline, color: HEADER_TEXT_MUTED, fontSize: 8 }
          : { text: '' },
      ],
    },
    // Колонка 3 —
    {
      stack: [
       
      ],
    },
  ]]

  content.push({
    table: {
      widths: ['auto', '*', 'auto'],
      body: headerBody,
    },
    layout: {
      fillColor: () => NAVY,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: (i: number) => (i === 0 ? 14 : i === 1 ? 4 : 8),
      paddingRight: (i: number) => (i === 0 ? 4 : i === 2 ? 14 : 8),
      paddingTop: () => 10,
      paddingBottom: () => 10,
    },
  })

  /* ── Title area ── */
  content.push({ text: '', margin: [0, 14, 0, 0] })

  content.push({
    text: 'К О М Е Р Ц І Й Н А   П Р О П О З И Ц І Я',
    fontSize: 17,
    bold: true,
    alignment: 'center',
    color: NAVY,
    margin: [0, 0, 0, 6],
  })

  if (input.title) {
    content.push({
      text: input.subtitle ? `${input.title} / ${input.subtitle}` : input.title,
      fontSize: 12,
      bold: true,
      alignment: 'center',
      color: '#222222',
      margin: [0, 0, 0, 3],
    })
  }

  if (input.tagline) {
    content.push({
      text: input.tagline,
      fontSize: 9,
      alignment: 'center',
      color: '#666666',
      margin: [0, 0, 0, 4],
    })
  }

  const dateParts: string[] = [`Актуально станом на: ${dateStr}`]
  if (input.usdRate) dateParts.push(`Курс $: ${input.usdRate} грн`)

  content.push({
    text: dateParts.join('   |   '),
    fontSize: 8,
    alignment: 'center',
    color: '#999999',
    margin: [0, 0, 0, 14],
  })

  /* ── Equipment cards ── */
  const cards = input.equipmentCards ?? []
  if (cards.length > 0) {
    content.push({
      text: 'ОСНОВНЕ ОБЛАДНАННЯ',
      bold: true,
      fontSize: 10,
      color: NAVY,
      margin: [0, 0, 0, 4],
    })
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: NAVY }],
      margin: [0, 0, 0, 6],
    })

    const makeCard = (card: ProposalEquipmentCard): Record<string, unknown> => ({
      stack: [
        { text: card.title.toUpperCase(), bold: true, fontSize: 7, color: '#666666', margin: [0, 0, 0, 4] },
        { text: card.highlight, bold: true, fontSize: 20, color: NAVY, margin: [0, 0, 0, 3] },
        card.spec1 ? { text: card.spec1, fontSize: 8, color: '#333333' } : { text: '' },
        card.spec2 ? { text: card.spec2, fontSize: 8, color: '#777777', margin: [0, 2, 0, 0] } : { text: '' },
      ],
      fillColor: CARD_BG,
    })

    const cardRows: Record<string, unknown>[][] = []
    for (let i = 0; i < cards.length; i += 2) {
      const right = cards[i + 1]
      cardRows.push([
        makeCard(cards[i]),
        right ? makeCard(right) : { text: '', fillColor: 'white' },
      ])
    }

    content.push({
      table: { widths: ['*', '*'], body: cardRows },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 12,
        paddingRight: () => 12,
        paddingTop: () => 9,
        paddingBottom: () => 9,
      },
      margin: [0, 0, 0, 10],
    })
  }

  /* ── Works section ── */
  if (input.worksDescription) {
    content.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'МОНТАЖНІ ТА ПУСКОНАЛАГОДЖУВАЛЬНІ РОБОТИ', bold: true, fontSize: 8, color: NAVY, margin: [0, 0, 0, 3] },
            { text: input.worksDescription, fontSize: 9, color: '#333333', lineHeight: 1.35 },
          ],
        }]],
      },
      layout: {
        fillColor: () => '#EEF3FA',
        hLineWidth: () => 0,
        vLineWidth: (i: number) => (i === 0 ? 3 : 0),
        vLineColor: () => NAVY,
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 0, 0, 8],
    })
  }

  /* ── Spec table — BEFORE tech specs ── */
  content.push({
    text: 'СПЕЦИФІКАЦІЯ ОБЛАДНАННЯ ТА ВАРТІСТЬ',
    bold: true,
    fontSize: 10,
    color: NAVY,
    margin: [0, cards.length > 0 || !!input.worksDescription ? 10 : 0, 0, 4],
  } as Record<string, unknown>)

  content.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: NAVY }],
    margin: [0, 0, 0, 6],
  })

  const tableBody: Record<string, unknown>[][] = [
    [
      { text: '№', bold: true, fontSize: 8, alignment: 'center', color: NAVY, fillColor: '#E8EEF5' },
      { text: 'Найменування обладнання / роботи', bold: true, fontSize: 8, color: NAVY, fillColor: '#E8EEF5' },
      { text: 'К-сть', bold: true, fontSize: 8, alignment: 'right', color: NAVY, fillColor: '#E8EEF5' },
      { text: 'Одн.', bold: true, fontSize: 8, alignment: 'center', color: NAVY, fillColor: '#E8EEF5' },
      { text: 'Ціна, грн', bold: true, fontSize: 8, alignment: 'right', color: NAVY, fillColor: '#E8EEF5' },
      { text: 'Сума, грн', bold: true, fontSize: 8, alignment: 'right', color: NAVY, fillColor: '#E8EEF5' },
    ],
  ]

  let equipmentTotal = 0
  input.items.forEach((item, idx) => {
    const lineTotal = item.quantity * item.pricePerUnit
    equipmentTotal += lineTotal
    tableBody.push([
      { text: String(idx + 1), alignment: 'center', fontSize: 9 },
      { text: item.name, fontSize: 9 },
      { text: fmtQty(item.quantity), alignment: 'right', fontSize: 9 },
      { text: item.unit, alignment: 'center', fontSize: 9 },
      { text: fmtMoney(item.pricePerUnit), alignment: 'right', fontSize: 9 },
      { text: fmtMoney(lineTotal), alignment: 'right', bold: true, fontSize: 9 },
    ])
  })

  const worksPercent = input.worksPercent && input.worksPercent > 0 ? input.worksPercent : 0
  const worksAmount = worksPercent > 0 ? Math.round(equipmentTotal * worksPercent / 100 * 100) / 100 : 0

  if (worksPercent > 0) {
    const worksRowBg = '#EEF3FA'
    const worksLabel = input.worksDescription
      ? input.worksDescription
      : 'Монтажні та пусконалагоджувальні роботи'
    tableBody.push([
      { text: String(input.items.length + 1), alignment: 'center', fontSize: 9, fillColor: worksRowBg },
      { text: worksLabel, fontSize: 9, color: NAVY, fillColor: worksRowBg },
      { text: `-`, alignment: 'right', fontSize: 9, color: '#555555', fillColor: worksRowBg },
      { text: '-', alignment: 'center', fontSize: 8, color: '#555555', fillColor: worksRowBg },
      { text: '—', alignment: 'right', fontSize: 9, color: '#999999', fillColor: worksRowBg },
      { text: fmtMoney(worksAmount), alignment: 'right', bold: true, fontSize: 9, color: NAVY, fillColor: worksRowBg },
    ])
  }

  const grandTotal = equipmentTotal + worksAmount

  content.push({
    table: {
      headerRows: 1,
      widths: [24, '*', 50, 36, 72, 72],
      dontBreakRows: true,
      body: tableBody,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#CCCCCC',
      vLineColor: () => '#DDDDDD',
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  })

  /* ── Grand total bar ── */
  content.push({
    table: {
      widths: ['*', 'auto'],
      body: [[
        { text: 'ЗАГАЛЬНА СУМА', bold: true, fontSize: 11, color: 'white', alignment: 'right' },
        { text: `${fmtMoney(grandTotal)} грн`, bold: true, fontSize: 12, color: 'white', alignment: 'right' },
      ]],
    },
    layout: {
      fillColor: () => NAVY,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 14,
      paddingRight: () => 14,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
    margin: [0, 4, 0, 0],
  })

  /* ── Tech specs — AFTER spec table ── */
  if (input.techSpecs) {
    content.push({
      text: 'ТЕХНІЧНІ ХАРАКТЕРИСТИКИ СИСТЕМИ',
      bold: true,
      fontSize: 9,
      color: NAVY,
      margin: [0, 10, 0, 4],
    })

    const lines = input.techSpecs.split('\n').filter((l) => l.trim())
    const techTableBody: Record<string, unknown>[][] = lines.map((line) => {
      const ci = line.indexOf(':')
      if (ci > 0) {
        return [
          { text: line.substring(0, ci).trim(), bold: true, fontSize: 8, color: '#333333' },
          { text: line.substring(ci + 1).trim(), fontSize: 8, color: '#555555' },
        ]
      }
      return [{ text: line, fontSize: 8, colSpan: 2, color: '#333333' }, { text: '' }]
    })

    content.push({
      table: { widths: ['*', '*'], body: techTableBody },
      layout: {
        hLineWidth: (_i: number, node: { table: { body: unknown[] } }) =>
          _i === 0 || _i === node.table.body.length ? 0.5 : 0.3,
        vLineWidth: () => 0,
        hLineColor: () => '#CCCCCC',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      margin: [0, 0, 0, 0],
    })
  }

  /* ── Footer info bar ── */
  const footerParts = [companyName, companyWebsite, companyPhone].filter(Boolean)

  return pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 52],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    info: { title: input.title || 'Комерційна пропозиція' },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 4, 40, 0],
      table: {
        widths: ['*', 'auto'],
        body: [[
          { text: footerParts.join('   |   '), fontSize: 7, color: '#999999' },
          { text: `Сторінка ${currentPage} з ${pageCount}`, fontSize: 7, color: '#999999', alignment: 'right' },
        ]],
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 0.5 : 0),
        vLineWidth: () => 0,
        hLineColor: () => '#DDDDDD',
        paddingTop: () => 5,
        paddingBottom: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
      },
    }),
  }).getBuffer()
}
