import { isElevatedRole } from '../../utils/authz'
import { emptyToNull } from '../../utils/strings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { name, contactPerson, phone, email, address, notes, taxCode, iban, bankName, bankMfo } = body

  const nameTrimmed = typeof name === 'string' ? name.trim() : ''
  if (!nameTrimmed) throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })

  const client = await prisma.client.create({
    data: {
      name: nameTrimmed,
      contactPerson: emptyToNull(contactPerson),
      phone: emptyToNull(phone),
      email: emptyToNull(email),
      address: emptyToNull(address),
      notes: emptyToNull(notes),
      taxCode: emptyToNull(taxCode),
      iban: emptyToNull(iban),
      bankName: emptyToNull(bankName),
      bankMfo: emptyToNull(bankMfo),
    },
  })

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'CREATE', entityType: 'Client', entityId: client.id, changes: { name: nameTrimmed } })

  return { client }
})
