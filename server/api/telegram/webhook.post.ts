const TG_API = 'https://api.telegram.org/bot'

async function sendMessage(token: string, chatId: number, text: string, extra?: object) {
  try {
    await $fetch(`${TG_API}${token}/sendMessage`, {
      method: 'POST',
      body: { chat_id: chatId, text, ...extra },
    })
  } catch (e) {
    console.error('[TG webhook] sendMessage error:', e)
  }
}

async function requestContact(token: string, chatId: number) {
  await sendMessage(token, chatId,
    'Щоб отримувати сповіщення CRM — поділіться своїм номером телефону 👇',
    {
      reply_markup: {
        keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    },
  )
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.telegramBotToken
  if (!token) return { ok: true }

  let body: any = null
  try {
    body = await readBody(event)
  } catch {
    return { ok: true }
  }

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
    const rawPhone = (msg.contact.phone_number ?? '').replace(/[^\d+]/g, '')
    // Check with and without leading +
    const variants = [rawPhone, rawPhone.replace(/^\+/, ''), `+${rawPhone.replace(/^\+/, '')}`]

    const user = await prisma.user.findFirst({
      where: { phone: { in: variants }, isActive: true },
    })

    if (!user) {
      await sendMessage(token, chatId,
        `❌ Користувача з номером ${rawPhone} не знайдено.\nЗверніться до адміністратора — він має додати ваш номер у профіль.`,
        { reply_markup: { remove_keyboard: true } },
      )
      return { ok: true }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: String(chatId) },
    })

    await sendMessage(token, chatId,
      `✅ ${user.name}, ваш акаунт підключено!\nВи будете отримувати сповіщення про завдання.`,
      { reply_markup: { remove_keyboard: true } },
    )
    return { ok: true }
  }

  // Any other message — show contact button again
  await requestContact(token, chatId)
  return { ok: true }
})
