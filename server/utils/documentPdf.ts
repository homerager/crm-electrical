import { getPdfMake, fmtMoney, fmtQty, pdfTableLayout, defaultDocStyles, pdfFooter } from './pdfBase'

/* ────────────────────── Shared types ────────────────────── */

export interface MaterialRow {
  name: string
  sku: string | null
  unit: string
  quantity: number
  pricePerUnit: number
}

export interface LaborRow {
  userName: string
  totalHours: number
  hourlyRate: number | null
  totalAmount: number | null
}

export interface ClientInfo {
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxCode: string | null
  iban: string | null
  bankName: string | null
  bankMfo: string | null
}

export interface ObjectInfo {
  name: string
  address: string | null
}

/* ────────────────────── Signature block ────────────────────── */

function signatureBlock(leftTitle: string, rightTitle: string): Record<string, unknown> {
  const sigCol = (title: string) => ({
    width: '45%',
    stack: [
      { text: title, bold: true, fontSize: 9, margin: [0, 0, 0, 30] as number[] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] },
      { text: '(підпис / ПІБ)', fontSize: 7, color: '#888888', margin: [0, 2, 0, 0] as number[] },
    ],
  })
  return {
    columns: [sigCol(leftTitle), { width: '*', text: '' }, sigCol(rightTitle)],
    margin: [0, 40, 0, 0] as number[],
  }
}

/* ────────────────────── 1. КОШТОРИС (Estimate) ────────────────────── */

export interface EstimateInput {
  object: ObjectInfo
  client: ClientInfo | null
  materials: MaterialRow[]
  labor: LaborRow[]
  number: string
  date: string
  notes?: string
}

export async function buildEstimatePdf(input: EstimateInput): Promise<Buffer> {
  const pdfMake = getPdfMake()
  const dateStr = new Date(input.date).toLocaleDateString('uk-UA')

  const content: Record<string, unknown>[] = [
    { text: `КОШТОРИС №${input.number}`, style: 'title', alignment: 'center' },
    { text: `на виконання робіт на об'єкті: ${input.object.name}`, style: 'subtitle', alignment: 'center', margin: [0, 4, 0, 16] },
  ]

  const infoLines: Record<string, unknown>[] = [
    { text: [{ text: 'Дата: ', bold: true }, dateStr] },
  ]
  if (input.object.address) {
    infoLines.push({ text: [{ text: 'Адреса об\'єкта: ', bold: true }, input.object.address] })
  }
  if (input.client) {
    infoLines.push({ text: [{ text: 'Замовник: ', bold: true }, input.client.name] })
    if (input.client.address) {
      infoLines.push({ text: [{ text: 'Адреса замовника: ', bold: true }, input.client.address] })
    }
    if (input.client.taxCode) {
      infoLines.push({ text: [{ text: 'ЄДРПОУ / ІПН: ', bold: true }, input.client.taxCode] })
    }
  }
  content.push({ stack: infoLines, margin: [0, 0, 0, 12] })

  if (input.notes) {
    content.push({ text: [{ text: 'Примітки: ', bold: true }, input.notes], margin: [0, 0, 0, 8] })
  }

  // Materials table
  if (input.materials.length > 0) {
    content.push({ text: '1. Матеріали', style: 'sectionHeader' })

    const matRows: Record<string, unknown>[][] = [[
      { text: '№', style: 'th', alignment: 'center' },
      { text: 'Найменування', style: 'th' },
      { text: 'Арт.', style: 'th' },
      { text: 'Од.', style: 'th', alignment: 'center' },
      { text: 'К-сть', style: 'th', alignment: 'right' },
      { text: 'Ціна, грн', style: 'th', alignment: 'right' },
      { text: 'Сума, грн', style: 'th', alignment: 'right' },
    ]]

    let matTotal = 0
    input.materials.forEach((m, idx) => {
      const lineTotal = m.quantity * m.pricePerUnit
      matTotal += lineTotal
      matRows.push([
        { text: String(idx + 1), alignment: 'center' },
        { text: m.name },
        { text: m.sku || '—' },
        { text: m.unit, alignment: 'center' },
        { text: fmtQty(m.quantity), alignment: 'right' },
        { text: fmtMoney(m.pricePerUnit), alignment: 'right' },
        { text: fmtMoney(lineTotal), alignment: 'right', bold: true },
      ])
    })

    matRows.push([
      { text: 'Разом матеріали:', colSpan: 6, alignment: 'right', bold: true }, {}, {}, {}, {}, {},
      { text: fmtMoney(matTotal), alignment: 'right', bold: true },
    ])

    content.push({
      table: { headerRows: 1, widths: [24, '*', 50, 32, 50, 64, 70], dontBreakRows: true, body: matRows },
      layout: pdfTableLayout,
    })
  }

  // Labor table
  if (input.labor.length > 0) {
    content.push({ text: '2. Роботи', style: 'sectionHeader' })

    const labRows: Record<string, unknown>[][] = [[
      { text: '№', style: 'th', alignment: 'center' },
      { text: 'Працівник', style: 'th' },
      { text: 'Годин', style: 'th', alignment: 'right' },
      { text: 'Ставка, грн/год', style: 'th', alignment: 'right' },
      { text: 'Сума, грн', style: 'th', alignment: 'right' },
    ]]

    let labTotal = 0
    input.labor.forEach((l, idx) => {
      const amount = l.totalAmount ?? 0
      labTotal += amount
      labRows.push([
        { text: String(idx + 1), alignment: 'center' },
        { text: l.userName },
        { text: fmtQty(l.totalHours), alignment: 'right' },
        { text: l.hourlyRate != null ? fmtMoney(l.hourlyRate) : '—', alignment: 'right' },
        { text: l.totalAmount != null ? fmtMoney(l.totalAmount) : '—', alignment: 'right', bold: true },
      ])
    })

    labRows.push([
      { text: 'Разом роботи:', colSpan: 4, alignment: 'right', bold: true }, {}, {}, {},
      { text: fmtMoney(labTotal), alignment: 'right', bold: true },
    ])

    content.push({
      table: { headerRows: 1, widths: [24, '*', 60, 90, 80], dontBreakRows: true, body: labRows },
      layout: pdfTableLayout,
    })
  }

  // Grand total
  const matSum = input.materials.reduce((s, m) => s + m.quantity * m.pricePerUnit, 0)
  const labSum = input.labor.reduce((s, l) => s + (l.totalAmount ?? 0), 0)
  const grandTotal = matSum + labSum

  content.push({
    text: [{ text: 'ВСЬОГО ПО КОШТОРИСУ: ', bold: true, fontSize: 11 }, { text: `${fmtMoney(grandTotal)} грн`, fontSize: 11, bold: true }],
    margin: [0, 16, 0, 0],
    alignment: 'right',
  })

  content.push(signatureBlock('Виконавець', 'Замовник'))

  return pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    info: { title: `Кошторис №${input.number}` },
    styles: defaultDocStyles,
    content,
    footer: pdfFooter,
  }).getBuffer()
}

/* ────────────────────── 2. АКТ ВИКОНАНИХ РОБІТ (Completion Act) ────────────────────── */

export interface ActInput {
  object: ObjectInfo
  client: ClientInfo | null
  materials: MaterialRow[]
  labor: LaborRow[]
  number: string
  date: string
  periodFrom?: string
  periodTo?: string
  notes?: string
}

export async function buildActPdf(input: ActInput): Promise<Buffer> {
  const pdfMake = getPdfMake()
  const dateStr = new Date(input.date).toLocaleDateString('uk-UA')

  const content: Record<string, unknown>[] = [
    { text: `АКТ ВИКОНАНИХ РОБІТ №${input.number}`, style: 'title', alignment: 'center' },
    { text: `Об'єкт: ${input.object.name}`, style: 'subtitle', alignment: 'center', margin: [0, 4, 0, 16] },
  ]

  const infoLines: Record<string, unknown>[] = [
    { text: [{ text: 'Дата складання: ', bold: true }, dateStr] },
  ]
  if (input.periodFrom && input.periodTo) {
    const from = new Date(input.periodFrom).toLocaleDateString('uk-UA')
    const to = new Date(input.periodTo).toLocaleDateString('uk-UA')
    infoLines.push({ text: [{ text: 'Період виконання: ', bold: true }, `${from} — ${to}`] })
  }
  if (input.object.address) {
    infoLines.push({ text: [{ text: 'Адреса об\'єкта: ', bold: true }, input.object.address] })
  }
  if (input.client) {
    infoLines.push({ text: [{ text: 'Замовник: ', bold: true }, input.client.name] })
    if (input.client.taxCode) {
      infoLines.push({ text: [{ text: 'ЄДРПОУ / ІПН: ', bold: true }, input.client.taxCode] })
    }
  }
  content.push({ stack: infoLines, margin: [0, 0, 0, 12] })

  if (input.notes) {
    content.push({ text: [{ text: 'Примітки: ', bold: true }, input.notes], margin: [0, 0, 0, 8] })
  }

  // Materials consumed
  if (input.materials.length > 0) {
    content.push({ text: '1. Використані матеріали', style: 'sectionHeader' })

    const matRows: Record<string, unknown>[][] = [[
      { text: '№', style: 'th', alignment: 'center' },
      { text: 'Найменування', style: 'th' },
      { text: 'Од.', style: 'th', alignment: 'center' },
      { text: 'К-сть', style: 'th', alignment: 'right' },
      { text: 'Ціна, грн', style: 'th', alignment: 'right' },
      { text: 'Сума, грн', style: 'th', alignment: 'right' },
    ]]

    let matTotal = 0
    input.materials.forEach((m, idx) => {
      const lineTotal = m.quantity * m.pricePerUnit
      matTotal += lineTotal
      matRows.push([
        { text: String(idx + 1), alignment: 'center' },
        { text: m.name },
        { text: m.unit, alignment: 'center' },
        { text: fmtQty(m.quantity), alignment: 'right' },
        { text: fmtMoney(m.pricePerUnit), alignment: 'right' },
        { text: fmtMoney(lineTotal), alignment: 'right', bold: true },
      ])
    })

    matRows.push([
      { text: 'Разом матеріали:', colSpan: 5, alignment: 'right', bold: true }, {}, {}, {}, {},
      { text: fmtMoney(matTotal), alignment: 'right', bold: true },
    ])

    content.push({
      table: { headerRows: 1, widths: [24, '*', 32, 56, 68, 74], dontBreakRows: true, body: matRows },
      layout: pdfTableLayout,
    })
  }

  // Labor
  if (input.labor.length > 0) {
    content.push({ text: '2. Виконані роботи (трудовитрати)', style: 'sectionHeader' })

    const labRows: Record<string, unknown>[][] = [[
      { text: '№', style: 'th', alignment: 'center' },
      { text: 'Працівник', style: 'th' },
      { text: 'Годин', style: 'th', alignment: 'right' },
      { text: 'Ставка, грн/год', style: 'th', alignment: 'right' },
      { text: 'Сума, грн', style: 'th', alignment: 'right' },
    ]]

    let labTotal = 0
    input.labor.forEach((l, idx) => {
      const amount = l.totalAmount ?? 0
      labTotal += amount
      labRows.push([
        { text: String(idx + 1), alignment: 'center' },
        { text: l.userName },
        { text: fmtQty(l.totalHours), alignment: 'right' },
        { text: l.hourlyRate != null ? fmtMoney(l.hourlyRate) : '—', alignment: 'right' },
        { text: l.totalAmount != null ? fmtMoney(l.totalAmount) : '—', alignment: 'right', bold: true },
      ])
    })

    labRows.push([
      { text: 'Разом роботи:', colSpan: 4, alignment: 'right', bold: true }, {}, {}, {},
      { text: fmtMoney(labTotal), alignment: 'right', bold: true },
    ])

    content.push({
      table: { headerRows: 1, widths: [24, '*', 60, 90, 80], dontBreakRows: true, body: labRows },
      layout: pdfTableLayout,
    })
  }

  // Grand total
  const matSum = input.materials.reduce((s, m) => s + m.quantity * m.pricePerUnit, 0)
  const labSum = input.labor.reduce((s, l) => s + (l.totalAmount ?? 0), 0)
  const grandTotal = matSum + labSum

  content.push({
    text: [{ text: 'ЗАГАЛЬНА ВАРТІСТЬ ВИКОНАНИХ РОБІТ: ', bold: true, fontSize: 11 }, { text: `${fmtMoney(grandTotal)} грн`, fontSize: 11, bold: true }],
    margin: [0, 16, 0, 0],
    alignment: 'right',
  })

  content.push({
    text: 'Роботи виконані в повному обсязі та у встановлені строки. Замовник претензій щодо обсягу, якості та строків виконання робіт не має.',
    margin: [0, 16, 0, 0],
    italics: true,
    fontSize: 9,
  })

  content.push(signatureBlock('Виконавець', 'Замовник'))

  return pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    info: { title: `Акт виконаних робіт №${input.number}` },
    styles: defaultDocStyles,
    content,
    footer: pdfFooter,
  }).getBuffer()
}

/* ────────────────────── 3. ДОГОВІР (Contract) ────────────────────── */

export interface ContractInput {
  object: ObjectInfo
  client: ClientInfo
  number: string
  date: string
  totalAmount: number
  prepaymentPercent?: number
  warrantyMonths?: number
  notes?: string
}

export async function buildContractPdf(input: ContractInput): Promise<Buffer> {
  const pdfMake = getPdfMake()
  const dateStr = new Date(input.date).toLocaleDateString('uk-UA')
  const c = input.client
  const prepay = input.prepaymentPercent ?? 0
  const warranty = input.warrantyMonths ?? 12

  const content: Record<string, unknown>[] = [
    { text: `ДОГОВІР №${input.number}`, style: 'title', alignment: 'center' },
    { text: 'на виконання будівельно-монтажних робіт', style: 'subtitle', alignment: 'center', margin: [0, 4, 0, 4] },
    { text: `м. ________          ${dateStr}`, alignment: 'center', margin: [0, 0, 0, 16] },
  ]

  // Preamble
  const clientLabel = c.name + (c.contactPerson ? `, в особі ${c.contactPerson}` : '')
  content.push({
    text: [
      { text: 'Виконавець', bold: true },
      ', з однієї сторони, та ',
      { text: clientLabel, bold: true },
      ' (надалі — «Замовник»), з іншої сторони, разом іменовані «Сторони», уклали цей Договір про таке:',
    ],
    margin: [0, 0, 0, 12],
    lineHeight: 1.4,
  })

  // 1. Предмет договору
  content.push({ text: '1. Предмет договору', style: 'sectionHeader' })
  content.push({
    text: [
      '1.1. Виконавець зобов\'язується виконати будівельно-монтажні роботи на об\'єкті: ',
      { text: input.object.name, bold: true },
      input.object.address ? ` (${input.object.address})` : '',
      ', а Замовник зобов\'язується прийняти і оплатити виконані роботи.',
    ],
    lineHeight: 1.4,
  })
  content.push({
    text: '1.2. Обсяг та перелік робіт визначається кошторисом, що є невід\'ємною частиною цього Договору.',
    lineHeight: 1.4,
    margin: [0, 4, 0, 0],
  })

  // 2. Вартість та порядок розрахунків
  content.push({ text: '2. Вартість та порядок розрахунків', style: 'sectionHeader' })
  content.push({
    text: [
      '2.1. Загальна вартість робіт за цим Договором становить: ',
      { text: `${fmtMoney(input.totalAmount)} грн`, bold: true },
      '.',
    ],
    lineHeight: 1.4,
  })
  if (prepay > 0) {
    content.push({
      text: `2.2. Замовник здійснює передоплату у розмірі ${prepay}% від загальної вартості робіт протягом 5 (п'яти) банківських днів з моменту підписання Договору.`,
      lineHeight: 1.4,
      margin: [0, 4, 0, 0],
    })
    content.push({
      text: '2.3. Остаточний розрахунок здійснюється протягом 5 (п\'яти) банківських днів після підписання Акту виконаних робіт.',
      lineHeight: 1.4,
      margin: [0, 4, 0, 0],
    })
  } else {
    content.push({
      text: '2.2. Оплата здійснюється протягом 5 (п\'яти) банківських днів після підписання Акту виконаних робіт.',
      lineHeight: 1.4,
      margin: [0, 4, 0, 0],
    })
  }

  // Contractor payment details
  if (c.iban || c.taxCode || c.bankName) {
    content.push({ text: 'Реквізити Замовника:', bold: true, margin: [0, 8, 0, 4] })
    const details: Record<string, unknown>[] = []
    if (c.taxCode) details.push({ text: [{ text: 'ЄДРПОУ / ІПН: ', bold: true }, c.taxCode] })
    if (c.iban) details.push({ text: [{ text: 'IBAN: ', bold: true }, c.iban] })
    if (c.bankName) details.push({ text: [{ text: 'Банк: ', bold: true }, c.bankName] })
    if (c.bankMfo) details.push({ text: [{ text: 'МФО: ', bold: true }, c.bankMfo] })
    if (c.phone) details.push({ text: [{ text: 'Тел.: ', bold: true }, c.phone] })
    if (c.email) details.push({ text: [{ text: 'Email: ', bold: true }, c.email] })
    content.push({ stack: details, fontSize: 9 })
  }

  // 3. Обов'язки сторін
  content.push({ text: '3. Обов\'язки сторін', style: 'sectionHeader' })
  content.push({
    text: '3.1. Виконавець зобов\'язується:',
    bold: true,
    lineHeight: 1.4,
  })
  content.push({
    ul: [
      'виконати роботи якісно, відповідно до кошторису та будівельних норм;',
      'забезпечити об\'єкт необхідними матеріалами відповідно до кошторису;',
      'дотримуватись встановлених строків виконання робіт;',
      'після завершення робіт передати об\'єкт Замовнику за Актом виконаних робіт.',
    ],
    lineHeight: 1.4,
    margin: [0, 4, 0, 4],
  })
  content.push({
    text: '3.2. Замовник зобов\'язується:',
    bold: true,
    lineHeight: 1.4,
  })
  content.push({
    ul: [
      'забезпечити безперешкодний доступ Виконавця до об\'єкта;',
      'своєчасно здійснювати оплату відповідно до умов Договору;',
      'прийняти виконані роботи за Актом виконаних робіт.',
    ],
    lineHeight: 1.4,
    margin: [0, 4, 0, 0],
  })

  // 4. Гарантійні зобов'язання
  content.push({ text: '4. Гарантійні зобов\'язання', style: 'sectionHeader' })
  content.push({
    text: `4.1. Виконавець надає гарантію на виконані роботи строком ${warranty} місяців з моменту підписання Акту виконаних робіт.`,
    lineHeight: 1.4,
  })
  content.push({
    text: '4.2. Протягом гарантійного строку Виконавець зобов\'язується за власний рахунок усунути виявлені дефекти та недоліки.',
    lineHeight: 1.4,
    margin: [0, 4, 0, 0],
  })

  // 5. Відповідальність
  content.push({ text: '5. Відповідальність сторін', style: 'sectionHeader' })
  content.push({
    text: '5.1. У разі порушення строків оплати Замовник сплачує пеню у розмірі 0,1% від несплаченої суми за кожен день прострочення.',
    lineHeight: 1.4,
  })
  content.push({
    text: '5.2. У разі порушення строків виконання робіт Виконавець сплачує пеню у розмірі 0,1% від вартості невиконаних робіт за кожен день прострочення.',
    lineHeight: 1.4,
    margin: [0, 4, 0, 0],
  })

  // 6. Строк дії
  content.push({ text: '6. Строк дії та інші умови', style: 'sectionHeader' })
  content.push({
    text: '6.1. Цей Договір набирає чинності з моменту його підписання Сторонами і діє до повного виконання Сторонами своїх зобов\'язань.',
    lineHeight: 1.4,
  })
  content.push({
    text: '6.2. Всі зміни та доповнення до цього Договору є дійсними, якщо вони вчинені у письмовій формі та підписані уповноваженими представниками Сторін.',
    lineHeight: 1.4,
    margin: [0, 4, 0, 0],
  })
  content.push({
    text: '6.3. Договір складено у двох примірниках, по одному для кожної зі Сторін.',
    lineHeight: 1.4,
    margin: [0, 4, 0, 0],
  })

  if (input.notes) {
    content.push({ text: [{ text: 'Додаткові умови: ', bold: true }, input.notes], margin: [0, 12, 0, 0], lineHeight: 1.4 })
  }

  content.push(signatureBlock('Виконавець', 'Замовник'))

  return pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    info: { title: `Договір №${input.number}` },
    styles: defaultDocStyles,
    content,
    footer: pdfFooter,
  }).getBuffer()
}
