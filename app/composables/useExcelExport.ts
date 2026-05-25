export type ExportColumn = {
  /** Заголовок колонки в Excel. */
  title: string
  /** Ключ поля в об'єкті. Підтримує крапкову нотацію: `client.name`. */
  key: string
  /** Кастомний форматер значення. Має повернути примітив (рядок/число/дату). */
  format?: (value: any, row: any) => any
  /** Ширина колонки в символах (опц.) */
  width?: number
}

export interface ExportToExcelOptions {
  /** Назва файлу без розширення. */
  filename: string
  /** Колонки для експорту. Якщо не передати — використовуються всі поля першого рядка. */
  columns?: ExportColumn[]
  /** Дані. */
  rows: any[]
  /** Назва аркуша. За замовчуванням 'Sheet1'. */
  sheetName?: string
}

function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined
  if (path in obj) return obj[path]
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function normalizeValue(value: any): any {
  if (value == null) return ''
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') return value.toNumber()
    if ('name' in value && typeof value.name === 'string') return value.name
    if ('title' in value && typeof value.title === 'string') return value.title
    if ('label' in value && typeof value.label === 'string') return value.label
    if (Array.isArray(value)) {
      return value
        .map((v) => normalizeValue(v))
        .filter((v) => v !== '' && v != null)
        .join(', ')
    }
    return JSON.stringify(value)
  }
  return value
}

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'export'
}

/**
 * Експорт довільної таблиці в .xlsx.
 *
 * Використання:
 *   const { exportToExcel } = useExcelExport()
 *   await exportToExcel({
 *     filename: 'Товари',
 *     rows: products.value,
 *     columns: [
 *       { title: 'Назва', key: 'name' },
 *       { title: 'Артикул', key: 'sku' },
 *       { title: 'Група', key: 'group.name' },
 *     ],
 *   })
 */
export function useExcelExport() {
  async function exportToExcel(opts: ExportToExcelOptions) {
    const rows = Array.isArray(opts.rows) ? opts.rows : []
    if (!rows.length) return false

    const XLSX: any = await import('xlsx')

    let columns = opts.columns
    if (!columns || !columns.length) {
      const first = rows[0] ?? {}
      columns = Object.keys(first)
        .filter((k) => typeof first[k] !== 'function')
        .map((k) => ({ title: k, key: k }))
    }

    const header = columns.map((c) => c.title)
    const data = rows.map((row) => {
      return columns!.map((col) => {
        const raw = getByPath(row, col.key)
        const formatted = col.format ? col.format(raw, row) : raw
        return normalizeValue(formatted)
      })
    })

    const aoa = [header, ...data]
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    sheet['!cols'] = columns.map((c) => ({
      wch: c.width ?? Math.min(40, Math.max(c.title.length + 2, 12)),
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, opts.sheetName || 'Sheet1')

    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `${sanitizeFilename(opts.filename)}_${stamp}.xlsx`
    XLSX.writeFile(wb, filename)
    return true
  }

  return { exportToExcel }
}
