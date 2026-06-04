import { setTelegramWebhook } from '../../utils/telegram'
import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.manage')

  const config = useRuntimeConfig()
  if (!config.telegramBotToken) {
    throw createError({ statusCode: 400, statusMessage: 'TELEGRAM_BOT_TOKEN не налаштовано' })
  }

  const webhookUrl = `${config.appUrl.replace(/\/$/, '')}/api/telegram/webhook`
  const result = await setTelegramWebhook(webhookUrl)

  return { ok: true, webhookUrl, telegramResponse: result }
})
