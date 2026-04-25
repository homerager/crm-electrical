import { escapeMarkdown } from '../../utils/telegram'

const TG_API = 'https://api.telegram.org/bot'

async function reply(token: string, chatId: number, text: string, extra?: object) {
  try {
    await $fetch(`${TG_API}${token}/sendMessage`, {
      method: 'POST',
      body: { chat_id: chatId, text, parse_mode: 'MarkdownV2', ...extra },
    })
  } catch {}
}

async function requestContact(token: string, chatId: number) {
  await $fetch(`${TG_API}${token}/sendMessage`, {
    method: 'POST',
    body: {
      chat_id: chatId,
      text: 'Щоб отримувати сповіщення CRM, поділіться своїм номером телефону\\.',
      parse_mode: 'MarkdownV2',
      reply_markup: {
        keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    },
  })
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.telegramBotToken
  if (!token) return { ok: true }

  const body = await readBody(event).catch(() => null)
  if (!body?.message) return { ok: true }

  const msg = body.message
  const chatId: number = msg.chat.id

  // /start command — ask for phone
  if (msg.text?.startsWith('/start')) {
    await requestContact(token, chatId)
    return { ok: true }
  }

  // User shared contact
  if (msg.contact) {
    const rawPhone = msg.contact.phone_number ?? ''
    // Normalize: keep digits and leading +
    const phone = rawPhone.replace(/[^\d+]/g, '')

    // Try to find user with matching phone (check both +380... and 380... forms)
    const variants = [phone, phone.replace(/^\+/, ''), `+${phone.replace(/^\+/, '')}`]
    const user = await prisma.user.findFirst({
      where: { phone: { in: variants }, isActive: true },
    })

    if (!user) {
      await reply(
        token, chatId,
        `❌ Користувача з номером *${escapeMarkdown(phone)}* не знайдено в системі\\.\nЗверніться до адміністратора для додавання номеру телефону до вашого профілю\\.`,
        { reply_markup: { remove_keyboard: true } },
      )
      return { ok: true }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: String(chatId) },
    })

    await $fetch(`${TG_API}${token}/sendMessage`, {
      method: 'POST',
      body: {
        chat_id: chatId,
        text: `✅ *${escapeMarkdown(user.name)}*, ваш акаунт підключено\\!\nВи будете отримувати сповіщення про завдання\\.`,
        parse_mode: 'MarkdownV2',
        reply_markup: { remove_keyboard: true },
      },
    }).catch(() => {})
    return { ok: true }
  }

  // Unknown input
  await requestContact(token, chatId)
  return { ok: true }
})
