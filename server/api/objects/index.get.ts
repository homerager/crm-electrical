

export default defineEventHandler(async () => {
  const objects = await prisma.constructionObject.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return { objects }
})
