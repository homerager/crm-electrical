export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return { attachments }
})
