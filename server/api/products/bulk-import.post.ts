import { isElevatedRole } from '../../utils/authz'

type ImportRow = {
  name?: string
  description?: string
  sku?: string
  unit?: string
  groupName?: string
}

type RowError = { row: number; message: string }

const DEFAULT_UNIT = 'шт'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{ items?: ImportRow[]; skipDuplicateSku?: boolean }>(event)
  const items = Array.isArray(body?.items) ? body!.items : []
  const skipDuplicateSku = body?.skipDuplicateSku !== false

  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'Файл порожній або не містить рядків' })
  }
  if (items.length > 5000) {
    throw createError({ statusCode: 400, statusMessage: 'Забагато рядків (максимум 5000)' })
  }

  const errors: RowError[] = []
  const cleaned: { rowIndex: number; data: { name: string; description: string | null; sku: string | null; unit: string; groupName: string | null } }[] = []

  const seenSku = new Set<string>()
  items.forEach((raw, idx) => {
    const rowNum = idx + 2
    const name = (raw?.name || '').toString().trim()
    if (!name) {
      errors.push({ row: rowNum, message: 'Назва порожня' })
      return
    }
    const sku = (raw?.sku || '').toString().trim() || null
    if (sku && seenSku.has(sku.toLowerCase())) {
      errors.push({ row: rowNum, message: `Артикул "${sku}" повторюється у файлі` })
      return
    }
    if (sku) seenSku.add(sku.toLowerCase())

    cleaned.push({
      rowIndex: rowNum,
      data: {
        name,
        description: (raw?.description || '').toString().trim() || null,
        sku,
        unit: (raw?.unit || '').toString().trim() || DEFAULT_UNIT,
        groupName: (raw?.groupName || '').toString().trim() || null,
      },
    })
  })

  const skus = cleaned.map((c) => c.data.sku).filter((s): s is string => !!s)
  const existingBySku = skus.length
    ? await prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } })
    : []
  const existingSkuSet = new Set(existingBySku.map((p) => p.sku!.toLowerCase()))

  const groupNames = [...new Set(cleaned.map((c) => c.data.groupName).filter((g): g is string => !!g))]
  const existingGroups = groupNames.length
    ? await prisma.productGroup.findMany({ where: { name: { in: groupNames } } })
    : []
  const groupIdByName = new Map<string, string>()
  for (const g of existingGroups) groupIdByName.set(g.name.toLowerCase(), g.id)

  for (const name of groupNames) {
    if (groupIdByName.has(name.toLowerCase())) continue
    const created = await prisma.productGroup.create({ data: { name } })
    groupIdByName.set(name.toLowerCase(), created.id)
  }

  let created = 0
  for (const item of cleaned) {
    const { data, rowIndex } = item
    if (data.sku && existingSkuSet.has(data.sku.toLowerCase())) {
      if (skipDuplicateSku) {
        errors.push({ row: rowIndex, message: `Артикул "${data.sku}" вже існує — пропущено` })
        continue
      }
      errors.push({ row: rowIndex, message: `Артикул "${data.sku}" вже існує` })
      continue
    }
    try {
      const product = await prisma.product.create({
        data: {
          name: data.name,
          description: data.description,
          sku: data.sku,
          unit: data.unit,
          groupId: data.groupName ? groupIdByName.get(data.groupName.toLowerCase()) || null : null,
        },
      })
      created++
      writeAuditLog({
        userId: auth!.userId,
        userName: auth!.name,
        action: 'CREATE',
        entityType: 'Product',
        entityId: product.id,
        changes: { name: product.name, sku: product.sku, unit: product.unit, source: 'bulk-import' },
      })
    } catch (e: any) {
      errors.push({ row: rowIndex, message: e?.message || 'Помилка створення' })
    }
  }

  return { created, totalRows: items.length, errors }
})
