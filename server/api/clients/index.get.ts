export default defineEventHandler(async () => {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
  })
  return { clients }
})
