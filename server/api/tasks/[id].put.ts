import { sendTelegramMessage, buildTaskUpdatedMessage } from '../../utils/telegram'

const STATUS_LABELS: Record<string, string> = {
  TODO: 'До виконання', IN_PROGRESS: 'В роботі', REVIEW: 'На перевірці',
  DONE: 'Виконано', CANCELLED: 'Скасовано',
}
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Низький', MEDIUM: 'Середній', HIGH: 'Високий', URGENT: 'Терміново',
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const task = await prisma.task.findUnique({
    where: { id },
    include: { assignee: { select: { id: true, name: true, telegramChatId: true } } },
  })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

  const { title, description, status, priority, assignedToId, objectId, dueDate, estimatedHours } = body

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
      ...(objectId !== undefined && { objectId: objectId || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(estimatedHours !== undefined && { estimatedHours: estimatedHours !== null ? Number(estimatedHours) : null }),
    },
    include: {
      createdBy: { select: { id: true, name: true, telegramChatId: true } },
      assignee: { select: { id: true, name: true, telegramChatId: true } },
      object: { select: { id: true, name: true } },
    },
  })

  // Build human-readable change list for notification
  const changes: Record<string, string> = {}
  if (status !== undefined && status !== task.status)
    changes['Статус'] = `${STATUS_LABELS[task.status] ?? task.status} → ${STATUS_LABELS[status] ?? status}`
  if (priority !== undefined && priority !== task.priority)
    changes['Пріоритет'] = `${PRIORITY_LABELS[task.priority] ?? task.priority} → ${PRIORITY_LABELS[priority] ?? priority}`
  if (title !== undefined && title.trim() !== task.title)
    changes['Назва'] = title.trim()
  if (dueDate !== undefined) {
    const oldDue = task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk-UA') : 'не вказано'
    const newDue = dueDate ? new Date(dueDate).toLocaleDateString('uk-UA') : 'не вказано'
    if (oldDue !== newDue) changes['Дедлайн'] = `${oldDue} → ${newDue}`
  }

  if (Object.keys(changes).length > 0) {
    const config = useRuntimeConfig()
    const changer = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true },
    })
    const changerName = changer?.name ?? 'Користувач'
    const msg = buildTaskUpdatedMessage(updated, changerName, config.appUrl, changes)

    // Notify assignee
    const assigneeChatId = (updated.assignee as any)?.telegramChatId
    if (assigneeChatId) {
      sendTelegramMessage(assigneeChatId, msg)
    }

    // Notify creator (if different from changer and assignee)
    const creatorChatId = (updated.createdBy as any)?.telegramChatId
    const creatorId = (updated.createdBy as any)?.id
    if (creatorChatId && creatorId !== auth.userId && creatorId !== (updated.assignee as any)?.id) {
      sendTelegramMessage(creatorChatId, msg)
    }
  }

  return updated
})
