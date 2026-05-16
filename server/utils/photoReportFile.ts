import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const MAX_PHOTO_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const PHOTO_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'photo-reports')

function extensionFromFilename(name: string) {
  if (!name.includes('.')) return ''
  return name.split('.').pop()!.toLowerCase()
}

export function buildPhotoStoredName(originalFilename: string) {
  const ext = extensionFromFilename(originalFilename)
  return `${randomUUID()}${ext ? `.${ext}` : ''}`
}

export async function writePhotoBuffer(storedAs: string, data: Buffer) {
  await mkdir(PHOTO_UPLOAD_DIR, { recursive: true })
  await writeFile(join(PHOTO_UPLOAD_DIR, storedAs), data)
}

export function getPhotoFilePath(storedAs: string) {
  return join(PHOTO_UPLOAD_DIR, storedAs)
}

/**
 * Reads a stored photo file and returns its Buffer.
 */
export async function readPhotoBuffer(storedAs: string): Promise<Buffer> {
  return readFile(join(PHOTO_UPLOAD_DIR, storedAs))
}

/**
 * Minimal EXIF parser — extracts GPS coordinates and DateTimeOriginal from JPEG buffers.
 * Returns null fields when data is absent or the file isn't a JPEG with EXIF.
 */
export function parseBasicExif(data: Buffer): {
  latitude: number | null
  longitude: number | null
  takenAt: Date | null
} {
  const result = { latitude: null as number | null, longitude: null as number | null, takenAt: null as Date | null }

  if (data.length < 12) return result
  // JPEG SOI + APP1 marker
  if (data[0] !== 0xFF || data[1] !== 0xD8) return result

  let offset = 2
  while (offset < data.length - 4) {
    if (data[offset] !== 0xFF) break
    const marker = data[offset + 1]
    if (marker === 0xE1) {
      // APP1 — potential EXIF
      const segLen = data.readUInt16BE(offset + 2)
      const exifHeader = data.toString('ascii', offset + 4, offset + 10)
      if (exifHeader === 'Exif\0\0') {
        try {
          parseExifSegment(data, offset + 10, segLen - 8, result)
        } catch {
          // malformed EXIF — ignore
        }
      }
      break
    }
    const len = data.readUInt16BE(offset + 2)
    offset += 2 + len
  }

  return result
}

function parseExifSegment(
  buf: Buffer,
  tiffStart: number,
  _maxLen: number,
  out: { latitude: number | null; longitude: number | null; takenAt: Date | null },
) {
  const byteOrder = buf.toString('ascii', tiffStart, tiffStart + 2)
  const le = byteOrder === 'II'

  const readU16 = (off: number) => le ? buf.readUInt16LE(tiffStart + off) : buf.readUInt16BE(tiffStart + off)
  const readU32 = (off: number) => le ? buf.readUInt32LE(tiffStart + off) : buf.readUInt32BE(tiffStart + off)

  function readRational(off: number): number {
    const num = readU32(off)
    const den = readU32(off + 4)
    return den === 0 ? 0 : num / den
  }

  function readIfdEntries(ifdOffset: number): Map<number, { type: number; count: number; valueOffset: number }> {
    const map = new Map<number, { type: number; count: number; valueOffset: number }>()
    const entryCount = readU16(ifdOffset)
    for (let i = 0; i < entryCount; i++) {
      const eOff = ifdOffset + 2 + i * 12
      const tag = readU16(eOff)
      const type = readU16(eOff + 2)
      const count = readU32(eOff + 4)
      const valueOffset = readU32(eOff + 8)
      map.set(tag, { type, count, valueOffset })
    }
    return map
  }

  const ifd0Offset = readU32(4)
  const ifd0 = readIfdEntries(ifd0Offset)

  // DateTimeOriginal lives in EXIF sub-IFD
  const exifIfdPointer = ifd0.get(0x8769)
  if (exifIfdPointer) {
    const exifIfd = readIfdEntries(exifIfdPointer.valueOffset)
    const dateTag = exifIfd.get(0x9003) // DateTimeOriginal
    if (dateTag) {
      const str = buf.toString('ascii', tiffStart + dateTag.valueOffset, tiffStart + dateTag.valueOffset + 19)
      // format: "YYYY:MM:DD HH:MM:SS"
      const match = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
      if (match) {
        out.takenAt = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`)
      }
    }
  }

  // GPS info lives in GPS sub-IFD
  const gpsIfdPointer = ifd0.get(0x8825)
  if (gpsIfdPointer) {
    const gpsIfd = readIfdEntries(gpsIfdPointer.valueOffset)

    const latRef = gpsIfd.get(0x0001) // GPSLatitudeRef
    const latTag = gpsIfd.get(0x0002) // GPSLatitude
    const lonRef = gpsIfd.get(0x0003) // GPSLongitudeRef
    const lonTag = gpsIfd.get(0x0004) // GPSLongitude

    if (latTag && latRef) {
      const d = readRational(latTag.valueOffset)
      const m = readRational(latTag.valueOffset + 8)
      const s = readRational(latTag.valueOffset + 16)
      let lat = d + m / 60 + s / 3600
      // Read ref letter
      const refOff = latRef.count <= 4
        ? (ifd0Offset + 2 + /* find entry offset manually — simplified */ 0)
        : latRef.valueOffset
      const refChar = buf.toString('ascii', tiffStart + refOff, tiffStart + refOff + 1)
      if (refChar === 'S') lat = -lat
      out.latitude = lat
    }

    if (lonTag && lonRef) {
      const d = readRational(lonTag.valueOffset)
      const m = readRational(lonTag.valueOffset + 8)
      const s = readRational(lonTag.valueOffset + 16)
      let lon = d + m / 60 + s / 3600
      const refOff = lonRef.count <= 4
        ? (ifd0Offset + 2 + 0)
        : lonRef.valueOffset
      const refChar = buf.toString('ascii', tiffStart + refOff, tiffStart + refOff + 1)
      if (refChar === 'W') lon = -lon
      out.longitude = lon
    }
  }
}
