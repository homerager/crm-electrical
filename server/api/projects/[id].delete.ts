import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const id = getRouterParam(event, 'id')!
  const isElevated = isElevatedRole(auth?.role)

  const project = await prisma.project.findUnique({
    where: { id },
    include: { members: true },
  })

  if (!project) {
    throw createError({ statusCode: 404, message: 'Проєкт не знайдено' })
  }

  const member = project.members.find((m) => m.userId === auth.userId)
  if (!isElevated && member?.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Тільки власник або адмін може видалити проєкт' })
  }

  await prisma.task.updateMany({
    where: { projectId: id },
    data: { projectId: null },
  })

  await prisma.project.delete({ where: { id } })

  return { success: true }
})
