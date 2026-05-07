

export default defineEventHandler(async () => {
  const objects = await prisma.constructionObject.findMany({
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  })
  return { objects }
})
