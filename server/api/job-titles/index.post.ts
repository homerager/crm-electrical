import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { name, sortOrder } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Назва посади обовʼязкова' })
  }

  const existing = await prisma.jobTitle.findUnique({ where: { name: name.trim() } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Посада з такою назвою вже існує' })
  }

  const jobTitle = await prisma.jobTitle.create({
    data: {
      name: name.trim(),
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    },
    include: { _count: { select: { users: true } } },
  })

  return { jobTitle }
})
