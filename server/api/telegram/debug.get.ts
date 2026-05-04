import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403 })
  }

  const config = useRuntimeConfig()
  const token = config.telegramBotToken

  if (!token) {
    return { tokenSet: false, hint: 'Встановіть NUXT_TELEGRAM_BOT_TOKEN на сервері' }
  }

  // Check webhook info from Telegram
  try {
    const info = await $fetch<any>(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    return {
      tokenSet: true,
      tokenPreview: `${token.substring(0, 8)}...`,
      webhookInfo: info.result,
    }
  } catch (e: any) {
    return {
      tokenSet: true,
      tokenPreview: `${token.substring(0, 8)}...`,
      error: e?.message,
    }
  }
})


