import { requirePermission } from '../../../utils/authz'
import { writeAuditLog } from '../../../utils/auditLog'
import { decObjectLotQty } from '../../../utils/stockLots'

/**
 * One line to add to a panel.
 *  - kind 'stock'  → catalog product taken from the object's stock: writes off the exact lot
 *                    (product + supplier + price) via an OBJECT_WRITE_OFF movement.
 *  - kind 'custom' → free-text item: recorded for documentation only, no stock impact.
 */
interface ItemInput {
  kind: 'stock' | 'custom'
  productId?: string
  contractorId?: string | null
  pricePerUnit?: number | string
  vatPercent?: number | string
  name?: string
  unit?: string
  quantity: number | string
  note?: string
}

function parseQty(raw: unknown): number {
  const q = Number(raw)
  if (!Number.isFinite(q) || q <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість має бути більшою за 0' })
  }
  return q
}

function num(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalPanels.edit')

  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ items: ItemInput[]; date?: string }>(event)
  const items = body?.items
  if (!Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Додайте хоча б одну позицію' })
  }

  const panel = await prisma.electricalPanel.findUnique({ where: { id } })
  if (!panel) throw createError({ statusCode: 404, statusMessage: 'Електрощит не знайдено' })

  const date = body.date ? new Date(body.date) : new Date()

  const created = await prisma.$transaction(async (tx) => {
    const out = []
    for (const item of items) {
      const quantity = parseQty(item.quantity)

      if (item.kind === 'stock') {
        if (!item.productId) {
          throw createError({ statusCode: 400, statusMessage: 'Не вказано товар для списання' })
        }
        const contractorId = item.contractorId ?? null
        const pricePerUnit = num(item.pricePerUnit)
        const vatPercent = num(item.vatPercent)

        // Write off the exact object lot (throws if the object lacks the quantity).
        await decObjectLotQty(tx, panel.objectId, item.productId, contractorId, pricePerUnit, quantity)

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true, unit: true },
        })

        const movement = await tx.movement.create({
          data: {
            type: 'OBJECT_WRITE_OFF',
            objectId: panel.objectId,
            createdById: auth.userId,
            date,
            notes: `Електрощит: ${panel.name}`,
            items: {
              create: [{ productId: item.productId, contractorId, pricePerUnit, vatPercent, quantity }],
            },
          },
        })

        out.push(
          await tx.electricalPanelMaterial.create({
            data: {
              panelId: id,
              productId: item.productId,
              name: product?.name ?? item.name ?? 'Матеріал',
              unit: product?.unit ?? item.unit ?? 'шт',
              quantity,
              contractorId,
              pricePerUnit,
              vatPercent,
              writtenOff: true,
              movementId: movement.id,
              note: item.note?.trim() || null,
            },
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
              contractor: { select: { id: true, name: true } },
            },
          }),
        )
      } else {
        // Custom free-text material — documentation only.
        if (!item.name?.trim()) {
          throw createError({ statusCode: 400, statusMessage: 'Вкажіть назву довільної позиції' })
        }
        out.push(
          await tx.electricalPanelMaterial.create({
            data: {
              panelId: id,
              productId: null,
              name: item.name.trim(),
              unit: item.unit?.trim() || 'шт',
              quantity,
              pricePerUnit: num(item.pricePerUnit),
              writtenOff: false,
              note: item.note?.trim() || null,
            },
          }),
        )
      }
    }
    return out
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'ElectricalPanel',
    entityId: id,
    changes: { addedMaterials: created.length },
  })

  return { materials: created }
})
