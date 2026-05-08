import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { defaultMaterialMarkupPercent, defaultLaborMarkupPercent, defaultVatPercent, defaultClientVatPercent } = body

  const toDecimalOrNull = (v: unknown) =>
    v != null && v !== '' ? Number(v) : null

  const settings = await prisma.settings.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      defaultMaterialMarkupPercent: toDecimalOrNull(defaultMaterialMarkupPercent),
      defaultLaborMarkupPercent: toDecimalOrNull(defaultLaborMarkupPercent),
      defaultVatPercent: toDecimalOrNull(defaultVatPercent),
      defaultClientVatPercent: toDecimalOrNull(defaultClientVatPercent),
    },
    update: {
      defaultMaterialMarkupPercent: toDecimalOrNull(defaultMaterialMarkupPercent),
      defaultLaborMarkupPercent: toDecimalOrNull(defaultLaborMarkupPercent),
      defaultVatPercent: toDecimalOrNull(defaultVatPercent),
      defaultClientVatPercent: toDecimalOrNull(defaultClientVatPercent),
    },
  })

  writeAuditLog({
    userId: auth!.userId,
    userName: auth!.name,
    action: 'UPDATE',
    entityType: 'Settings',
    entityId: 'global',
    changes: { defaultMaterialMarkupPercent, defaultLaborMarkupPercent, defaultVatPercent, defaultClientVatPercent },
  })

  return { settings }
})
