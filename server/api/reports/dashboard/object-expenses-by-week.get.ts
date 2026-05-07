export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const now = new Date()
  const weeksBack = 12
  const from = new Date(now)
  from.setDate(from.getDate() - weeksBack * 7)

  const timeLogs = await prisma.timeLog.findMany({
    where: { date: { gte: from }, objectId: { not: null } },
    select: {
      date: true,
      hours: true,
      objectId: true,
      user: { select: { hourlyRate: true } },
    },
  })

  const movements = await prisma.movement.findMany({
    where: { date: { gte: from }, type: 'WAREHOUSE_TO_OBJECT', objectId: { not: null } },
    select: {
      date: true,
      fromWarehouseId: true,
      items: { select: { productId: true, quantity: true } },
    },
  })

  const productWarehousePairs = new Set<string>()
  for (const mov of movements) {
    if (!mov.fromWarehouseId) continue
    for (const item of mov.items) {
      productWarehousePairs.add(`${item.productId}:${mov.fromWarehouseId}`)
    }
  }

  const priceMap = new Map<string, number>()
  for (const pair of productWarehousePairs) {
    const [productId, warehouseId] = pair.split(':')
    const line = await prisma.invoiceItem.findFirst({
      where: { productId, invoice: { warehouseId } },
      orderBy: { invoice: { date: 'desc' } },
      select: { pricePerUnit: true },
    })
    if (line) priceMap.set(pair, Number(line.pricePerUnit))
  }

  function weekKey(date: Date): string {
    const d = new Date(date)
    const day = d.getDay() || 7
    d.setDate(d.getDate() + 4 - day)
    const yearStart = new Date(d.getFullYear(), 0, 1)
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
  }

  function weekMonday(wk: string): Date {
    const [yearStr, wStr] = wk.split('-W')
    const year = Number(yearStr)
    const week = Number(wStr)
    const jan4 = new Date(year, 0, 4)
    const dayOfWeek = jan4.getDay() || 7
    const monday = new Date(jan4)
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
    return monday
  }

  const buckets = new Map<string, { material: number; labor: number }>()

  const endWeek = weekKey(now)
  let cursor = new Date(from)
  while (weekKey(cursor) <= endWeek) {
    const wk = weekKey(cursor)
    if (!buckets.has(wk)) buckets.set(wk, { material: 0, labor: 0 })
    cursor.setDate(cursor.getDate() + 7)
  }

  for (const log of timeLogs) {
    const wk = weekKey(new Date(log.date))
    const bucket = buckets.get(wk)
    if (!bucket) continue
    const rate = log.user.hourlyRate != null ? Number(log.user.hourlyRate) : 0
    bucket.labor += log.hours * rate
  }

  for (const mov of movements) {
    const wk = weekKey(new Date(mov.date))
    const bucket = buckets.get(wk)
    if (!bucket) continue
    for (const item of mov.items) {
      const price = priceMap.get(`${item.productId}:${mov.fromWarehouseId}`) ?? 0
      bucket.material += Number(item.quantity) * price
    }
  }

  const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const labels = sorted.map(([wk]) => {
    const mon = weekMonday(wk)
    return `${String(mon.getDate()).padStart(2, '0')}.${String(mon.getMonth() + 1).padStart(2, '0')}`
  })
  const material = sorted.map(([, v]) => Math.round(v.material * 100) / 100)
  const labor = sorted.map(([, v]) => Math.round(v.labor * 100) / 100)

  return { labels, material, labor }
})
