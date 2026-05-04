import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const id = getRouterParam(event, 'id')!
  const isElevated = isElevatedRole(auth?.role)
  const body = await readBody(event)
  const { name, description, color, defaultObjectId } = body

  const project = await prisma.project.findUnique({
    where: { id },
    include: { members: true },
  })

  if (!project) {
    throw createError({ statusCode: 404, message: 'Проєкт не знайдено' })
  }

  const member = project.members.find((m) => m.userId === auth.userId)
  if (!isElevated && member?.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Тільки власник або адмін може редагувати проєкт' })
  }

  const data: {
    name: string
    description: string | null
    color: string
    defaultObjectId?: string | null
  } = {
    name: name?.trim() || project.name,
    description: description !== undefined ? description : project.description,
    color: color || project.color,
  }

  if (defaultObjectId !== undefined) {
    if (defaultObjectId === null || defaultObjectId === '') {
      data.defaultObjectId = null
    } else {
      const obj = await prisma.constructionObject.findUnique({ where: { id: defaultObjectId } })
      if (!obj) throw createError({ statusCode: 400, message: 'Обʼєкт не знайдено' })
      data.defaultObjectId = defaultObjectId
    }
  }

  const updated = await prisma.project.update({
    where: { id },
    data,
    include: {
      createdBy: { select: { id: true, name: true } },
      defaultObject: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true } } },
      },
      _count: { select: { tasks: true } },
    },
  })

  return updated
})
