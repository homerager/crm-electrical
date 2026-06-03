import { requirePermission } from '../../utils/authz'
import { emptyToNull } from '../../utils/strings'

function parseNonNegative(raw: unknown, label: string): number {
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw createError({ statusCode: 400, statusMessage: `${label} має бути невідʼємним числом` })
  }
  return value
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  await requirePermission(event, 'supplierPrices.manage')

  const body = await readBody(event)
  const { contractorId, productId, currency, validFrom, validTo, isActive, note } = body

  if (!contractorId) throw createError({ statusCode: 400, statusMessage: 'Оберіть постачальника' })
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Оберіть товар' })

  const [contractor, product] = await Promise.all([
    prisma.contractor.findUnique({ where: { id: contractorId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ])
  if (!contractor) throw createError({ statusCode: 404, statusMessage: 'Постачальника не знайдено' })
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Товар не знайдено' })

  const price = parseNonNegative(body.price, 'Ціна')
  const vatPercent = parseNonNegative(body.vatPercent ?? 0, 'ПДВ')
  const validFromDate = validFrom ? new Date(validFrom) : new Date()
  const validToDate = validTo ? new Date(validTo) : null

  try {
    const created = await prisma.supplierPrice.create({
      data: {
        contractorId,
        productId,
        price,
        currency: emptyToNull(currency) || 'UAH',
        vatPercent,
        validFrom: validFromDate,
        validTo: validToDate,
        isActive: isActive !== false,
        note: emptyToNull(note),
        createdById: auth!.userId,
      },
      include: {
        contractor: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, unit: true } },
      },
    })

    writeAuditLog({
      userId: auth!.userId,
      userName: auth!.name,
      action: 'CREATE',
      entityType: 'SupplierPrice',
      entityId: created.id,
      changes: { contractorId, productId, price, currency: created.currency, vatPercent },
    })

    return { price: created }
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Ціна для цього постачальника, товару і дати початку вже існує',
      })
    }
    throw e
  }
})
