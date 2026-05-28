const PREFIX = 'КН'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dateStr = query.date as string | undefined

  const parsed = dateStr ? new Date(dateStr) : new Date()
  const year = parsed.getFullYear()
  if (Number.isNaN(year)) {
    throw createError({ statusCode: 400, statusMessage: 'Невірна дата' })
  }

  const prefix = `${PREFIX}-${year}-`

  const invoices = await prisma.invoice.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  })

  let max = 0
  for (const inv of invoices) {
    const seq = parseInt(inv.number.slice(prefix.length), 10)
    if (!Number.isNaN(seq) && seq > max) max = seq
  }

  const number = `${prefix}${String(max + 1).padStart(4, '0')}`

  return { number }
})
