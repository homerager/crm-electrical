import { requirePermission } from '../../utils/authz'
import { getProductSupplyHistory } from '../../utils/productSupplyHistory'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalInstallationWorks.view')

  const id = getRouterParam(event, 'id')!

  const work = await prisma.electricalInstallationWork.findUnique({
    where: { id },
    include: {
      object: {
        select: {
          id: true,
          name: true,
          address: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      materials: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          contractor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!work) throw createError({ statusCode: 404, statusMessage: 'Роботу не знайдено' })

  // Attach the incoming invoices each catalog material was supplied by. Records are filtered to the
  // exact lot used (same supplier + unit price); when none match (e.g. legacy lots) we fall back to
  // the product's full supply history so the user still sees where it came from.
  const productIds = [...new Set(work.materials.map((m) => m.productId).filter(Boolean) as string[])]
  const historyMap = await getProductSupplyHistory(productIds)
  const materialsWithSupply = work.materials.map((m) => {
    if (!m.productId) return { ...m, supplyHistory: [] }
    const all = historyMap.get(m.productId) ?? []
    const price = Number(m.pricePerUnit)
    const matched = all.filter(
      (r) =>
        (r.contractor?.id ?? null) === (m.contractorId ?? null) &&
        Math.abs(r.pricePerUnit - price) < 0.01,
    )
    return { ...m, supplyHistory: matched.length > 0 ? matched : all }
  })

  // Available object stock lots (qty > 0) — feed the "add material from stock" picker.
  const objectStock = await prisma.objectStock.findMany({
    where: { objectId: work.objectId, quantity: { gt: 0 } },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      contractor: { select: { id: true, name: true } },
    },
    orderBy: [{ productId: 'asc' }, { pricePerUnit: 'asc' }],
  })

  return { work: { ...work, materials: materialsWithSupply }, objectStock }
})
