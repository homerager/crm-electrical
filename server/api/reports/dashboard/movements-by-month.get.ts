export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const invoices = await prisma.invoice.findMany({
    where: { date: { gte: from } },
    select: {
      type: true,
      date: true,
      items: { select: { quantity: true, pricePerUnit: true } },
    },
    orderBy: { date: 'asc' },
  })

  const buckets = new Map<string, { incoming: number; outgoing: number }>()

  for (let m = 0; m < 12; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + m, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { incoming: 0, outgoing: 0 })
  }

  for (const inv of invoices) {
    const d = new Date(inv.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key)
    if (!bucket) continue

    const total = inv.items.reduce(
      (sum, it) => sum + Number(it.quantity) * Number(it.pricePerUnit),
      0,
    )

    if (inv.type === 'INCOMING') bucket.incoming += total
    else bucket.outgoing += total
  }

  const labels: string[] = []
  const incoming: number[] = []
  const outgoing: number[] = []

  for (const [key, val] of buckets) {
    labels.push(key)
    incoming.push(Math.round(val.incoming * 100) / 100)
    outgoing.push(Math.round(val.outgoing * 100) / 100)
  }

  return { labels, incoming, outgoing }
})
