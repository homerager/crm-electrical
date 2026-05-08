export interface VatBreakdown {
  base: number
  vatAmount: number
  total: number
  vatPercent: number
}

/** Calculate VAT on top of a base (ex-VAT) amount */
export function calcVat(baseAmount: number, vatPercent: number): VatBreakdown {
  const vatAmount = Math.round(baseAmount * vatPercent) / 100
  return { base: baseAmount, vatAmount, total: baseAmount + vatAmount, vatPercent }
}

/** Extract VAT from a gross (inc-VAT) amount */
export function extractVat(totalWithVat: number, vatPercent: number): VatBreakdown {
  const base = vatPercent > 0 ? totalWithVat / (1 + vatPercent / 100) : totalWithVat
  const vatAmount = totalWithVat - base
  return { base, vatAmount, total: totalWithVat, vatPercent }
}

/** Sum multiple VatBreakdowns into one */
export function sumVat(items: VatBreakdown[]): VatBreakdown {
  const base = items.reduce((s, i) => s + i.base, 0)
  const vatAmount = items.reduce((s, i) => s + i.vatAmount, 0)
  return { base, vatAmount, total: base + vatAmount, vatPercent: 0 }
}
