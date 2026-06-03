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

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const before = await prisma.supplierPrice.findUnique({ where: { id } })
  if (!before) throw createError({ statusCode: 404, statusMessage: 'Ціну не знайдено' })

  const price = parseNonNegative(body.price ?? before.price, 'Ціна')
  const vatPercent = parseNonNegative(body.vatPercent ?? before.vatPercent, 'ПДВ')

  try {
    const updated = await prisma.supplierPrice.update({
      where: { id },
      data: {
        price,
        currency: emptyToNull(body.currency) || before.currency,
        vatPercent,
        validFrom: body.validFrom ? new Date(body.validFrom) : before.validFrom,
        validTo: body.validTo ? new Date(body.validTo) : (body.validTo === null ? null : before.validTo),
        isActive: typeof body.isActive === 'boolean' ? body.isActive : before.isActive,
        note: body.note !== undefined ? emptyToNull(body.note) : before.note,
      },
      include: {
        contractor: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, unit: true } },
      },
    })

    const diff = computeChanges(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
    if (diff) {
      writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'UPDATE', entityType: 'SupplierPrice', entityId: id, changes: diff })
    }

    return { price: updated }
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
