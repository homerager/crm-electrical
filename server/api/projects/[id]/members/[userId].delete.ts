export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const projectId = getRouterParam(event, 'id')!
  const targetUserId = getRouterParam(event, 'userId')!
  const isAdmin = auth?.role === 'ADMIN'

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  })

  if (!project) {
    throw createError({ statusCode: 404, message: 'Проєкт не знайдено' })
  }

  const requester = project.members.find((m) => m.userId === auth.userId)
  const canManage = isAdmin || requester?.role === 'OWNER' || targetUserId === auth.userId

  if (!canManage) {
    throw createError({ statusCode: 403, message: 'Доступ заборонено' })
  }

  const target = project.members.find((m) => m.userId === targetUserId)
  if (!target) {
    throw createError({ statusCode: 404, message: 'Учасника не знайдено' })
  }

  if (target.role === 'OWNER') {
    const otherOwners = project.members.filter((m) => m.role === 'OWNER' && m.userId !== targetUserId)
    if (otherOwners.length === 0 && !isAdmin) {
      throw createError({ statusCode: 400, message: 'Не можна видалити єдиного власника проєкту' })
    }
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  })

  return { success: true }
})
