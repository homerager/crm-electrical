import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contractor: true,
      warehouse: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  })

  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })

  return { invoice }
})
