import { sendTelegramMessage } from '../utils/telegram'

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return

  const INTERVAL_MS = 60 * 60 * 1000 // 1 hour

  async function checkOverduePayments() {
    try {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(23, 59, 59, 999)

      // Find schedules due today or overdue, still EXPECTED
      const overdueSchedules = await prisma.paymentSchedule.findMany({
        where: {
          status: 'EXPECTED',
          dueDate: { lte: tomorrow },
        },
        include: {
          object: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, telegramChatId: true } },
        },
      })

      if (!overdueSchedules.length) return

      // Notify admins and managers
      const managers = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
        select: { id: true, telegramChatId: true },
      })

      const isOverdue = (d: Date) => d < now
      const config = useRuntimeConfig()

      for (const schedule of overdueSchedules) {
        const overdue = isOverdue(schedule.dueDate)
        const amount = Number(schedule.amount).toLocaleString('uk-UA', { minimumFractionDigits: 2 })
        const dueDateStr = schedule.dueDate.toLocaleDateString('uk-UA')
        const prefix = overdue ? '🔴 Прострочений платіж' : '🟡 Платіж на сьогодні/завтра'
        const title = `${prefix}: ${amount} ₴`
        const body = [
          schedule.object?.name ? `Обʼєкт: ${schedule.object.name}` : null,
          schedule.client?.name ? `Клієнт: ${schedule.client.name}` : null,
          `Дата: ${dueDateStr}`,
          schedule.description || null,
        ].filter(Boolean).join(', ')

        // Mark as OVERDUE if past due
        if (overdue) {
          await prisma.paymentSchedule.update({
            where: { id: schedule.id },
            data: { status: 'OVERDUE' },
          })
        }

        // In-app notifications for all managers
        const managerIds = managers.map((m) => m.id)
        if (managerIds.length) {
          await createNotificationForMany(managerIds, {
            title,
            body,
            link: '/payments/schedule',
          })
        }

        // Telegram to managers with chatId
        const tgMsg = `${title}\n${body}\n${config.appUrl || ''}/payments/schedule`
        for (const m of managers) {
          if (m.telegramChatId) {
            sendTelegramMessage(m.telegramChatId, tgMsg)
          }
        }
      }
    } catch (e) {
      console.error('[PaymentReminders] Error:', e)
    }
  }

  // Run once at startup (with delay), then every hour
  setTimeout(checkOverduePayments, 30_000)
  setInterval(checkOverduePayments, INTERVAL_MS)
})
