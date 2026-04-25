import { setTelegramWebhook } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const config = useRuntimeConfig()
  if (!config.telegramBotToken) {
    throw createError({ statusCode: 400, statusMessage: 'TELEGRAM_BOT_TOKEN не налаштовано' })
  }

  const webhookUrl = `${config.appUrl}/api/telegram/webhook`
  const result = await setTelegramWebhook(webhookUrl)

  return { ok: true, webhookUrl, telegramResponse: result }
})
