/** Порожній рядок або відсутнє значення → null для збереження в БД. */
export function emptyToNull(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}
