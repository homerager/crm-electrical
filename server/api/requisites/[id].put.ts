import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, companyName, taxCode, iban, bankName, bankMfo, address, phone, email, isDefault } = body

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Назва реквізитів обовʼязкова' })

  if (isDefault) {
    await prisma.requisite.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } })
  }

  const requisite = await prisma.requisite.update({
    where: { id },
    data: { name, companyName: companyName || null, taxCode: taxCode || null, iban: iban || null, bankName: bankName || null, bankMfo: bankMfo || null, address: address || null, phone: phone || null, email: email || null, isDefault: !!isDefault },
  })

  return { requisite }
})
