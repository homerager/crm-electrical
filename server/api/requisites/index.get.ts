export default defineEventHandler(async () => {
  const requisites = await prisma.requisite.findMany({
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return { requisites }
})
