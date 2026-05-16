export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, color } = body

  const tag = await prisma.taskTag.findUnique({ where: { id } })
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'Тег не знайдено' })

  if (name !== undefined && name.trim()) {
    const dup = await prisma.taskTag.findFirst({
      where: { name: name.trim(), id: { not: id } },
    })
    if (dup) throw createError({ statusCode: 409, statusMessage: 'Тег з такою назвою вже існує' })
  }

  const updated = await prisma.taskTag.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
    },
  })

  return updated
})
