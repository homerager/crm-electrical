export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const { name, color } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Назва тегу обов\'язкова' })
  }

  const existing = await prisma.taskTag.findUnique({ where: { name: name.trim() } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Тег з такою назвою вже існує' })
  }

  const tag = await prisma.taskTag.create({
    data: {
      name: name.trim(),
      color: color || '#1976D2',
    },
  })

  return tag
})
