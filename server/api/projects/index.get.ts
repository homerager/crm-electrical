export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const isAdmin = auth?.role === 'ADMIN'

  const projects = await prisma.project.findMany({
    where: isAdmin
      ? undefined
      : {
          members: {
            some: { userId: auth.userId },
          },
        },
    include: {
      createdBy: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return projects
})
