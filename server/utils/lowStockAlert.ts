import type { Prisma } from '@prisma/client'
import { sendTelegramMessage, normalizeUrl } from './telegram'
import { sumWarehouseQty } from './stockLots'

const EPS = 1e-9

/**
 * Перевіряє сумарний залишок (склад, товар) по всіх лотах на досягнення мінімального
 * залишку та надсилає сповіщення (in-app + Telegram) усім користувачам, які підписалися
 * на low-stock. Поріг (`minStock`) і дедуплікація (`lowStockNotifiedAt`) зберігаються у
 * `WarehouseProductSetting` — рівень (склад, товар), а не окремого лота.
 *
 * Логіка дедуплікації:
 *   - якщо сумарний quantity < minStock і ще не сповіщали (lowStockNotifiedAt == null) — шлемо
 *   - як тільки quantity >= minStock — скидаємо lowStockNotifiedAt у null,
 *     щоб наступне падіння нижче порогу знову тригерило сповіщення.
 */
export async function checkLowStockAndNotify(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
) {
  const setting = await tx.warehouseProductSetting.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  })
  if (!setting || setting.minStock == null) return

  const min = Number(setting.minStock)
  if (!Number.isFinite(min) || min <= 0) return

  const qty = await sumWarehouseQty(tx, warehouseId, productId)

  const isLow = qty + EPS < min

  if (!isLow) {
    if (setting.lowStockNotifiedAt) {
      await tx.warehouseProductSetting.update({
        where: { warehouseId_productId: { warehouseId, productId } },
        data: { lowStockNotifiedAt: null },
      })
    }
    return
  }

  if (setting.lowStockNotifiedAt) return

  await tx.warehouseProductSetting.update({
    where: { warehouseId_productId: { warehouseId, productId } },
    data: { lowStockNotifiedAt: new Date() },
  })

  const [product, warehouse] = await Promise.all([
    tx.product.findUnique({ where: { id: productId }, select: { name: true, unit: true } }),
    tx.warehouse.findUnique({ where: { id: warehouseId }, select: { name: true } }),
  ])
  if (!product || !warehouse) return

  const recipients = await tx.user.findMany({
    where: { isActive: true, lowStockNotifications: true },
    select: { id: true, telegramChatId: true },
  })
  if (!recipients.length) return

  const qtyStr = qty.toLocaleString('uk-UA')
  const minStr = min.toLocaleString('uk-UA')
  const title = `⚠️ Мінімальний залишок: ${product.name}`
  const body = `Склад «${warehouse.name}»: ${qtyStr} ${product.unit} (мін. ${minStr})`
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
