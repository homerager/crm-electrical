export default defineEventHandler(async (event) => {
  const productId = getRouterParam(event, 'id')!

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, sku: true, unit: true },
  })
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Товар не знайдено' })

  const now = new Date()

  const supplierPrices = await prisma.supplierPrice.findMany({
    where: { productId },
    include: { contractor: { select: { id: true, name: true } } },
    orderBy: [{ price: 'asc' }],
  })

  const suppliers = supplierPrices.map((sp) => {
    const valid = sp.isActive
      && sp.validFrom <= now
      && (sp.validTo == null || sp.validTo >= now)
    return {
      id: sp.id,
      contractor: sp.contractor,
      price: Number(sp.price),
      currency: sp.currency,
      vatPercent: Number(sp.vatPercent),
      validFrom: sp.validFrom.toISOString(),
      validTo: sp.validTo ? sp.validTo.toISOString() : null,
      isActive: sp.isActive,
      isValid: valid,
      note: sp.note,
    }
  })

  // Last actual prices from incoming invoices (most recent first)
  const invoiceItems = await prisma.invoiceItem.findMany({
    where: { productId, invoice: { type: 'INCOMING' } },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          date: true,
          contractor: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { invoice: { date: 'desc' } },
    take: 10,
  })

  const lastInvoicePrices = invoiceItems.map((item) => ({
    invoice: { id: item.invoice.id, number: item.invoice.number, date: item.invoice.date.toISOString() },
    contractor: item.invoice.contractor,
    price: Number(item.pricePerUnit),
    vatPercent: Number(item.vatPercent),
    quantity: Number(item.quantity),
  }))

  // Best (lowest) currently valid supplier price
  const validSuppliers = suppliers.filter((s) => s.isValid)
  const best = validSuppliers.length
    ? validSuppliers.reduce((min, s) => (s.price < min.price ? s : min))
    : null

  return { product, suppliers, lastInvoicePrices, best }
})
