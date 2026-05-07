import { isElevatedRole } from '../../utils/authz'
import { emptyToNull } from '../../utils/strings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const {
    name,
    contactPerson,
    phone,
    email,
    address,
    notes,
    taxCode,
    iban,
    bankName,
    bankMfo,
    paymentNotes,
  } = body

  const nameTrimmed = typeof name === 'string' ? name.trim() : ''
  if (!nameTrimmed) throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })

  const before = await prisma.contractor.findUnique({ where: { id } })

  const contractor = await prisma.contractor.update({
    where: { id },
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
      paymentNotes: emptyToNull(paymentNotes),
    },
  })

  if (before) {
    const diff = computeChanges(before as unknown as Record<string, unknown>, contractor as unknown as Record<string, unknown>)
    if (diff) writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'UPDATE', entityType: 'Contractor', entityId: id, changes: diff })
  }

  return { contractor }
})
