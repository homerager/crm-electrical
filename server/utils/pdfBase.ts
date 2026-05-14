import { createRequire } from 'node:module'
import { join } from 'node:path'

// pdfmake — CommonJS; підвантажуємо з кореня проєкту (стабільно для Nitro bundle).
const requireFromRoot = createRequire(join(process.cwd(), 'package.json'))

export interface PdfMakeInstance {
  createPdf: (def: Record<string, unknown>) => { getBuffer: () => Promise<Buffer> }
  virtualfs: { writeFileSync: (name: string, buf: Buffer) => void }
  fonts: Record<string, Record<string, string>>
  setUrlAccessPolicy: (fn: (url: string) => boolean) => void
}

let pdfMakeSingleton: PdfMakeInstance | null = null

export function getPdfMake(): PdfMakeInstance {
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
    for (const [filename, content] of Object.entries(vfs)) {
      pdfMake.virtualfs.writeFileSync(filename, Buffer.from(content, 'base64'))
    }
    pdfMakeSingleton = pdfMake
  }
  return pdfMakeSingleton!
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtQty(n: number): string {
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

export const pdfTableLayout = {
  fillColor: (i: number) => (i === 0 ? '#eeeeee' : null),
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#cccccc',
  vLineColor: () => '#cccccc',
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

export const defaultDocStyles = {
  title: { fontSize: 16, bold: true },
  subtitle: { fontSize: 11, color: '#444444' },
  th: { bold: true, fontSize: 9 },
  sectionHeader: { fontSize: 11, bold: true, margin: [0, 16, 0, 6] as number[] },
}

export function pdfFooter(currentPage: number, pageCount: number) {
  return {
    margin: [40, 0, 40, 24],
    fontSize: 8,
    color: '#666666',
    text: `Стор. ${currentPage} з ${pageCount}`,
    alignment: 'center',
  }
}
