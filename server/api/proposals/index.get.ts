export default defineEventHandler(async () => {
  const proposals = await prisma.proposal.findMany({
    include: {
      createdBy: { select: { id: true, name: true } },
      requisite: { select: { id: true, name: true } },
      items: { select: { priceExVat: true, vatPercent: true, quantity: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const enriched = proposals.map((p) => {
    const totalExVat = p.items.reduce(
      (s, i) => s + Number(i.priceExVat) * Number(i.quantity),
      0,
    )
    const totalWithVat = p.items.reduce(
      (s, i) =>
        s + Number(i.priceExVat) * Number(i.quantity) * (1 + Number(i.vatPercent) / 100),
      0,
    )
    return { ...p, totalExVat, totalWithVat }
  })

  return { proposals: enriched }
})
