import { writeFile, mkdir, unlink, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const MAX_INVOICE_PDF_SIZE = 25 * 1024 * 1024 // 25 MB

function extensionFromFilename(name: string) {
  if (!name.includes('.')) return ''
  return name.split('.').pop()!.toLowerCase()
}

export function buildStoredInvoicePdfName(originalFilename: string) {
  const ext = extensionFromFilename(originalFilename) || 'pdf'
  return `${randomUUID()}.${ext}`
}

function uploadDir() {
  return join(process.cwd(), 'public', 'uploads', 'invoices')
}

export async function writeInvoicePdfBuffer(storedAs: string, data: Buffer) {
  const dir = uploadDir()
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, storedAs), data)
}

export async function readInvoicePdfBuffer(storedAs: string) {
  return readFile(join(uploadDir(), storedAs))
}

export async function removeInvoicePdfFile(storedAs: string) {
  try {
    await unlink(join(uploadDir(), storedAs))
  } catch {
    // ignore missing file
  }
}
