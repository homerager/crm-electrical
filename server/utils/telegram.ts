const TG_API = 'https://api.telegram.org/bot'

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, (c) => `\\${c}`)
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
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
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

  return [
    `📋 *Вам призначено нове завдання*`,
    ``,
    `*Назва:* ${escapeMarkdown(task.title)}`,
    `*Пріоритет:* ${escapeMarkdown(priorityLabels[task.priority] ?? task.priority)}`,
    `*Дедлайн:* ${escapeMarkdown(due)}`,
    task.description ? `*Опис:* ${escapeMarkdown(task.description.substring(0, 200))}` : null,
    ``,
    `🔗 [Відкрити завдання](${escapeMarkdown(normalizeUrl(appUrl, `/tasks/${task.id}`))})`,
  ].filter(Boolean).join('\n')
}

export function buildTaskUpdatedMessage(task: any, changedBy: string, appUrl: string, changes: Record<string, string>): string {
  const changeLines = Object.entries(changes)
    .map(([key, val]) => `  • ${escapeMarkdown(key)}: ${escapeMarkdown(val)}`)
    .join('\n')

  return [
    `🔄 *Завдання оновлено*`,
    ``,
    `*Назва:* ${escapeMarkdown(task.title)}`,
    changeLines,
    `*Змінив:* ${escapeMarkdown(changedBy)}`,
    ``,
    `🔗 [Відкрити завдання](${escapeMarkdown(normalizeUrl(appUrl, `/tasks/${task.id}`))})`,
  ].filter(Boolean).join('\n')
}

export function normalizeUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`
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

export { escapeMarkdown }
