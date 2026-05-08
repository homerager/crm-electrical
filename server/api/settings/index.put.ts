import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { defaultMaterialMarkupPercent, defaultLaborMarkupPercent } = body

  const settings = await prisma.settings.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      defaultMaterialMarkupPercent: defaultMaterialMarkupPercent != null && defaultMaterialMarkupPercent !== '' ? Number(defaultMaterialMarkupPercent) : null,
      defaultLaborMarkupPercent: defaultLaborMarkupPercent != null && defaultLaborMarkupPercent !== '' ? Number(defaultLaborMarkupPercent) : null,
    },
    update: {
      defaultMaterialMarkupPercent: defaultMaterialMarkupPercent != null && defaultMaterialMarkupPercent !== '' ? Number(defaultMaterialMarkupPercent) : null,
      defaultLaborMarkupPercent: defaultLaborMarkupPercent != null && defaultLaborMarkupPercent !== '' ? Number(defaultLaborMarkupPercent) : null,
    },
  })

  writeAuditLog({
    userId: auth!.userId,
    userName: auth!.name,
    action: 'UPDATE',
    entityType: 'Settings',
    entityId: 'global',
    changes: { defaultMaterialMarkupPercent, defaultLaborMarkupPercent },
  })

  return { settings }
})
