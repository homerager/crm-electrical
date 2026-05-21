

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const projectId = query.projectId as string | undefined

  const where: any = {}
  if (projectId) where.projectId = projectId

  const objects = await prisma.constructionObject.findMany({
    where,
    include: {
      client: true,
      project: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return { objects }
})
