const TG_API = 'https://api.telegram.org/bot'

export function normalizeUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const config = useRuntimeConfig()
  const token = config.telegramBotToken
  if (!token) return

  try {
    await $fetch(`${TG_API}${token}/sendMessage`, {
      method: 'POST',
      body: {
        chat_id: chatId,
        text,
        disable_web_page_preview: false,
      },
    })
  } catch (e) {
    console.error('[Telegram] Failed to send message:', e)
  }
}

export function buildTaskCreatedMessage(task: any, appUrl: string): string {
  const priorityLabels: Record<string, string> = {
    LOW: '🟢 Низький', MEDIUM: '🟡 Середній', HIGH: '🟠 Високий', URGENT: '🔴 Терміново',
  }
  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('uk-UA')
    : 'не вказано'

  const lines = [
    '📋 Вам призначено нове завдання',
    '',
    `Назва: ${task.title}`,
    `Пріоритет: ${priorityLabels[task.priority] ?? task.priority}`,
    `Дедлайн: ${due}`,
  ]
  if (task.description) {
    lines.push(`Опис: ${task.description.substring(0, 200)}`)
  }
  lines.push('')
  lines.push(`🔗 ${normalizeUrl(appUrl, `/tasks/${task.id}`)}`)

  return lines.join('\n')
}

export function buildTaskUpdatedMessage(
  task: any,
  changedBy: string,
  appUrl: string,
  changes: Record<string, string>,
): string {
  const changeLines = Object.entries(changes)
    .map(([key, val]) => `  • ${key}: ${val}`)
    .join('\n')

  const lines = [
    '🔄 Завдання оновлено',
    '',
    `Назва: ${task.title}`,
    changeLines,
    `Змінив: ${changedBy}`,
    '',
    `🔗 ${normalizeUrl(appUrl, `/tasks/${task.id}`)}`,
  ]

  return lines.join('\n')
}

export async function setTelegramWebhook(webhookUrl: string): Promise<any> {
  const config = useRuntimeConfig()
  const token = config.telegramBotToken
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')

  return $fetch(`${TG_API}${token}/setWebhook`, {
    method: 'POST',
    body: { url: webhookUrl, allowed_updates: ['message'] },
  })
}
