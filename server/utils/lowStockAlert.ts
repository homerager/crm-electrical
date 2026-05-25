import type { Prisma, PrismaClient } from '@prisma/client'
import { sendTelegramMessage, normalizeUrl } from './telegram'

const EPS = 1e-9

/**
 * Перевіряє рядок warehouseStock на досягнення мінімального залишку та надсилає
 * сповіщення (in-app + Telegram) усім користувачам, які підписалися на low-stock.
 *
 * Логіка дедуплікації:
 *   - якщо quantity < minStock і ще не сповіщали (lowStockNotifiedAt == null) — шлемо
 *   - як тільки quantity >= minStock — скидаємо lowStockNotifiedAt у null,
 *     щоб наступне падіння нижче порогу знову тригерило сповіщення.
 */
export async function checkLowStockAndNotify(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
) {
  const stock = await tx.warehouseStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
    include: {
      product: { select: { name: true, unit: true } },
      warehouse: { select: { name: true } },
    },
  })
  if (!stock || stock.minStock == null) return

  const qty = Number(stock.quantity)
  const min = Number(stock.minStock)
  if (!Number.isFinite(min) || min <= 0) return

  const isLow = qty + EPS < min

  if (!isLow) {
    if (stock.lowStockNotifiedAt) {
      await tx.warehouseStock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { lowStockNotifiedAt: null },
      })
    }
    return
  }

  if (stock.lowStockNotifiedAt) return

  await tx.warehouseStock.update({
    where: { productId_warehouseId: { productId, warehouseId } },
    data: { lowStockNotifiedAt: new Date() },
  })

  const recipients = await tx.user.findMany({
    where: { isActive: true, lowStockNotifications: true },
    select: { id: true, telegramChatId: true },
  })
  if (!recipients.length) return

  const qtyStr = qty.toLocaleString('uk-UA')
  const minStr = min.toLocaleString('uk-UA')
  const title = `⚠️ Мінімальний залишок: ${stock.product.name}`
  const body = `Склад «${stock.warehouse.name}»: ${qtyStr} ${stock.product.unit} (мін. ${minStr})`
  const link = `/warehouses/${warehouseId}`

  await tx.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      title,
      body,
      link,
    })),
  })

  // Fire-and-forget side-channels (after transaction commits there's no rollback risk,
  // but we still kick them off here — SSE/Telegram are non-transactional).
  for (const r of recipients) {
    sendSSEToUser(r.id, 'notification', {
      userId: r.id,
      title,
      body,
      link,
      isRead: false,
      createdAt: new Date().toISOString(),
    })
  }

  const config = useRuntimeConfig()
  const url = normalizeUrl(config.appUrl || '', link)
  const tgMsg = `${title}\n${body}\n${url}`
  for (const r of recipients) {
    if (r.telegramChatId) {
      sendTelegramMessage(r.telegramChatId, tgMsg)
    }
  }
}

/**
 * Зручний хелпер: викликати після оновлення warehouseStock.quantity у транзакції.
 * Викликати з тим же `tx`, щоб дедуплікація працювала разом з основним апдейтом.
 */
export async function checkLowStockAfterChange(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
) {
  try {
    await checkLowStockAndNotify(tx, warehouseId, productId)
  } catch (e) {
    console.error('[LowStockAlert] Failed:', e)
  }
}
