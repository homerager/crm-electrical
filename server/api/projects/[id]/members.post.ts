export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const projectId = getRouterParam(event, 'id')!
  const isAdmin = auth?.role === 'ADMIN'
  const body = await readBody(event)
  const { userId, role } = body

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId обовʼязковий' })
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  })

  if (!project) {
    throw createError({ statusCode: 404, message: 'Проєкт не знайдено' })
  }

  const requester = project.members.find((m) => m.userId === auth.userId)
  if (!isAdmin && requester?.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Тільки власник або адмін може керувати учасниками' })
  }

  const existing = project.members.find((m) => m.userId === userId)
  if (existing) {
    throw createError({ statusCode: 409, message: 'Користувач вже є учасником' })
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role: role === 'OWNER' ? 'OWNER' : 'MEMBER',
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  })

  return member
})
