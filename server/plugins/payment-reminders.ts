import { sendTelegramMessage } from '../utils/telegram'
import { sendEmail, buildPaymentReminderEmail } from '../utils/email'

const DEDUP_HOURS = 24

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return

  const INTERVAL_MS = 60 * 60 * 1000 // 1 hour

  async function checkOverduePayments() {
    try {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(23, 59, 59, 999)

      const dedupCutoff = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000)

      // Find EXPECTED schedules due today/tomorrow or already overdue,
      // that haven't been notified in the last 24 hours
      const schedules = await prisma.paymentSchedule.findMany({
        where: {
          status: 'EXPECTED',
          dueDate: { lte: tomorrow },
          OR: [
            { lastNotifiedAt: null },
            { lastNotifiedAt: { lt: dedupCutoff } },
          ],
        },
        include: {
          object: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
      })

      if (!schedules.length) return

      const managers = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
        select: { id: true, email: true, telegramChatId: true, emailNotifications: true },
      })

      const config = useRuntimeConfig()
      const managerIds = managers.map((m) => m.id)

      for (const schedule of schedules) {
        const overdue = schedule.dueDate < now
        const amount = Number(schedule.amount)
        const amountStr = amount.toLocaleString('uk-UA', { minimumFractionDigits: 2 })
        const dueDateStr = schedule.dueDate.toLocaleDateString('uk-UA')
        const prefix = overdue ? '🔴 Прострочений платіж' : '🟡 Платіж на сьогодні/завтра'
        const title = `${prefix}: ${amountStr} ₴`
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
            data: { status: 'OVERDUE', lastNotifiedAt: now },
          })
        } else {
          await prisma.paymentSchedule.update({
            where: { id: schedule.id },
            data: { lastNotifiedAt: now },
          })
        }

        // In-app notifications
        if (managerIds.length) {
          await createNotificationForMany(managerIds, {
            title,
            body,
            link: '/payments/schedule',
          })
        }

        // Telegram
        const tgMsg = `${title}\n${body}\n${config.appUrl || ''}/payments/schedule`
        for (const m of managers) {
          if (m.telegramChatId) {
            sendTelegramMessage(m.telegramChatId, tgMsg)
          }
        }

        // Email
        const { subject, html } = buildPaymentReminderEmail({
          amount,
          dueDate: schedule.dueDate,
          objectName: schedule.object?.name,
          clientName: schedule.client?.name,
          description: schedule.description,
          isOverdue: overdue,
        }, config.appUrl || '')

        for (const m of managers) {
          if (m.email && m.emailNotifications) {
            sendEmail(m.email, subject, html)
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
