export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  await prisma.jobTitle.delete({ where: { id } })

  return { ok: true }
})
