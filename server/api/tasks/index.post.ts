import { sendTelegramMessage, buildTaskCreatedMessage } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const { title, description, priority, assignedToId, objectId, parentId, dueDate, estimatedHours } = body

  if (!title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Назва завдання обов\'язкова' })
  }

  if (parentId) {
    const parent = await prisma.task.findUnique({ where: { id: parentId } })
    if (!parent) throw createError({ statusCode: 404, statusMessage: 'Батьківське завдання не знайдено' })
    if (parent.parentId) throw createError({ statusCode: 400, statusMessage: 'Не можна створити підзавдання до підзавдання' })
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || 'MEDIUM',
      assignedToId: assignedToId || null,
      objectId: objectId || null,
      parentId: parentId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      createdById: auth.userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
    },
  })

  // Telegram notification to assignee (fire-and-forget)
  if (task.assignedToId && task.assignedToId !== auth.userId) {
    const assignee = await prisma.user.findUnique({
      where: { id: task.assignedToId },
      select: { telegramChatId: true },
    })
    if (assignee?.telegramChatId) {
      const config = useRuntimeConfig()
      const msg = buildTaskCreatedMessage(task, config.appUrl)
      sendTelegramMessage(assignee.telegramChatId, msg)
    }
  }

  return task
})
