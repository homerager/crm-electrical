import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, sortOrder } = body

  const data: { name?: string; sortOrder?: number } = {}
  if (name !== undefined) {
    const trimmed = name?.trim()
    if (!trimmed) throw createError({ statusCode: 400, statusMessage: 'Назва не може бути порожньою' })
    const clash = await prisma.jobTitle.findFirst({
      where: { name: trimmed, NOT: { id } },
    })
    if (clash) {
      throw createError({ statusCode: 409, statusMessage: 'Посада з такою назвою вже існує' })
    }
    data.name = trimmed
  }
  if (sortOrder !== undefined && typeof sortOrder === 'number') {
    data.sortOrder = sortOrder
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Немає даних для оновлення' })
  }

  const jobTitle = await prisma.jobTitle.update({
    where: { id },
    data,
    include: { _count: { select: { users: true } } },
  })

  return { jobTitle }
})
