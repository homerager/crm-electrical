import { getProductSupplyHistory, attachSupplyHistory } from '../../utils/productSupplyHistory'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      // Stock is now per lot (warehouse + product + contractor + price). Show lots with a
      // positive quantity; min-stock settings live in WarehouseProductSetting (product-level)
      // and are merged in below.
      stock: {
        where: { quantity: { gt: 0 } },
        include: { product: true, contractor: { select: { id: true, name: true } } },
        orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      },
      // Min-stock thresholds (and notification dedup) per (warehouse, product).
      productSettings: {
        include: { product: true },
      },
    },
  })

  if (!warehouse) throw createError({ statusCode: 404, statusMessage: 'Склад не знайдено' })

  // Product-level min-stock thresholds, keyed by productId.
  const settingByProduct = new Map(
    warehouse.productSettings.map((s) => [s.productId, s]),
  )

  // Total physical quantity per product across all its lots (for product-level low-stock check).
  const totalByProduct = new Map<string, number>()
  for (const lot of warehouse.stock) {
    totalByProduct.set(lot.productId, (totalByProduct.get(lot.productId) ?? 0) + Number(lot.quantity))
  }

  // Each lot row carries the product-level min threshold and the product's total quantity, so
  // the UI can flag low stock against the aggregate (not a single lot) and edit the threshold.
  const stockRows = warehouse.stock.map((lot) => {
    const setting = settingByProduct.get(lot.productId)
    return {
      ...lot,
      minStock: setting?.minStock ?? null,
      lowStockNotifiedAt: setting?.lowStockNotifiedAt ?? null,
      productTotalQuantity: totalByProduct.get(lot.productId) ?? Number(lot.quantity),
    }
  })

  // Surface products that have a min-stock threshold set but currently no stock lots, so the
  // user can still see and adjust them (matches the previous "show even at 0 if min set" behaviour).
  const settingOnlyRows = warehouse.productSettings
    .filter((s) => s.minStock != null && !totalByProduct.has(s.productId))
    .map((setting) => ({
      id: `setting-${setting.id}`,
      productId: setting.productId,
      warehouseId: id,
      contractorId: null,
      pricePerUnit: 0,
      vatPercent: 0,
      quantity: 0,
      updatedAt: setting.updatedAt,
      product: setting.product,
      contractor: null,
      minStock: setting.minStock,
      lowStockNotifiedAt: setting.lowStockNotifiedAt,
      productTotalQuantity: 0,
    }))

  const allRows = [...stockRows, ...settingOnlyRows].sort((a, b) =>
    (a.product?.name ?? '').localeCompare(b.product?.name ?? '', 'uk'),
  )

  const productIds = allRows.map((s) => s.productId)
  const supplyMap = await getProductSupplyHistory(productIds, id)

  const { productSettings, ...warehouseRest } = warehouse

  return {
    warehouse: {
      ...warehouseRest,
      stock: attachSupplyHistory(allRows, supplyMap),
    },
  }
})
