import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')!

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true, type: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  if (!payment) throw createError({ statusCode: 404, statusMessage: 'Оплату не знайдено' })

  return payment
})
