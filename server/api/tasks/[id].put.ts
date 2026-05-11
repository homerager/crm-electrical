import { sendTelegramMessage, buildTaskUpdatedMessage } from '../../utils/telegram'
import { sendEmail, buildTaskUpdatedEmail, buildTaskReassignedEmail } from '../../utils/email'

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

  const auditDiff = computeChanges(task as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
  if (auditDiff) writeAuditLog({ userId: auth.userId, userName: auth.name, action: 'UPDATE', entityType: 'Task', entityId: id, changes: auditDiff })

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

  if (assignedToId !== undefined && assignedToId && assignedToId !== task.assignedToId && assignedToId !== auth.userId) {
    createNotification({
      userId: assignedToId,
      title: `Вам призначено завдання: ${updated.title}`,
      link: `/tasks/${id}`,
    })
    const newAssignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { email: true, emailNotifications: true },
    })
    if (newAssignee?.email && newAssignee.emailNotifications) {
      const config = useRuntimeConfig()
      const changer = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } })
      const { subject, html } = buildTaskReassignedEmail(updated, changer?.name ?? 'Користувач', config.appUrl)
      sendEmail(newAssignee.email, subject, html)
    }
  }

  if (Object.keys(changes).length > 0) {
    const config = useRuntimeConfig()
    const changer = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true },
    })
    const changerName = changer?.name ?? 'Користувач'
    const msg = buildTaskUpdatedMessage(updated, changerName, config.appUrl, changes)

    const changeSummary = Object.entries(changes).map(([k, v]) => `${k}: ${v}`).join(', ')
    const notifRecipients = new Set<string>()
    const assigneeId = (updated.assignee as any)?.id
    const creatorId = (updated.createdBy as any)?.id
    if (assigneeId && assigneeId !== auth.userId) notifRecipients.add(assigneeId)
    if (creatorId && creatorId !== auth.userId) notifRecipients.add(creatorId)

    if (notifRecipients.size) {
      createNotificationForMany([...notifRecipients], {
        title: `Завдання оновлено: ${updated.title}`,
        body: `${changerName}: ${changeSummary}`,
        link: `/tasks/${id}`,
      })
    }

    // Notify assignee via Telegram
    const assigneeChatId = (updated.assignee as any)?.telegramChatId
    if (assigneeChatId) {
      sendTelegramMessage(assigneeChatId, msg)
    }

    // Notify creator via Telegram (if different from changer and assignee)
    const creatorChatId = (updated.createdBy as any)?.telegramChatId
    if (creatorChatId && creatorId !== auth.userId && creatorId !== assigneeId) {
      sendTelegramMessage(creatorChatId, msg)
    }

    // Send email notifications
    const { subject: emailSubject, html: emailHtml } = buildTaskUpdatedEmail(updated, changerName, changes, config.appUrl)
    const emailRecipients = await prisma.user.findMany({
      where: { id: { in: [...notifRecipients] } },
      select: { email: true, emailNotifications: true },
    })
    for (const r of emailRecipients) {
      if (r.email && r.emailNotifications) sendEmail(r.email, emailSubject, emailHtml)
    }
  }

  return updated
})
