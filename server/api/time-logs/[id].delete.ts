import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const log = await prisma.timeLog.findUnique({ where: { id } })
  if (!log) throw createError({ statusCode: 404, statusMessage: 'Запис не знайдено' })

  if (log.userId !== auth.userId && !isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  await prisma.timeLog.delete({ where: { id } })

  return { ok: true }
})
