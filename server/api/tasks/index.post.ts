import { sendTelegramMessage, buildTaskCreatedMessage } from '../../utils/telegram'
import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  if (auth.role === 'EMPLOYEE') {
    throw createError({ statusCode: 403, statusMessage: 'Працівник не може створювати завдання' })
  }

  const body = await readBody(event)
  const { title, description, priority, assignedToId, objectId, parentId, projectId, dueDate, estimatedHours } = body

  if (!title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Назва завдання обов\'язкова' })
  }

  if (parentId) {
    const parent = await prisma.task.findUnique({ where: { id: parentId } })
    if (!parent) throw createError({ statusCode: 404, statusMessage: 'Батьківське завдання не знайдено' })
    if (parent.parentId) throw createError({ statusCode: 400, statusMessage: 'Не можна створити підзавдання до підзавдання' })
  }

  if (projectId && !isElevatedRole(auth.role)) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: auth.userId } },
    })
    if (!member) throw createError({ statusCode: 403, message: 'Ви не є учасником цього проєкту' })
  }

  let resolvedObjectId = objectId || null
  if (projectId && !resolvedObjectId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { defaultObjectId: true },
    })
    resolvedObjectId = proj?.defaultObjectId ?? null
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || 'MEDIUM',
      assignedToId: assignedToId || null,
      objectId: resolvedObjectId,
      projectId: projectId || null,
      parentId: parentId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      createdById: auth.userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  })

  writeAuditLog({ userId: auth.userId, userName: auth.name, action: 'CREATE', entityType: 'Task', entityId: task.id, changes: { title: task.title, priority: task.priority, status: 'TODO' } })

  if (task.assignedToId && task.assignedToId !== auth.userId) {
    createNotification({
      userId: task.assignedToId,
      title: `Вам призначено завдання: ${task.title}`,
      body: task.project ? `Проєкт: ${task.project.name}` : undefined,
      link: `/tasks/${task.id}`,
    })

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

  if (task.projectId) {
    const members = await prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      select: { userId: true },
    })
    const recipientIds = members
      .map((m) => m.userId)
      .filter((uid) => uid !== auth.userId && uid !== task.assignedToId)
    if (recipientIds.length) {
      createNotificationForMany(recipientIds, {
        title: `Нове завдання: ${task.title}`,
        body: `Створив(ла) ${task.createdBy.name}`,
        link: `/tasks/${task.id}`,
      })
    }
  }

  return task
})
