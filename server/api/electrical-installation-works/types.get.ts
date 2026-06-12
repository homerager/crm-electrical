import { requirePermission } from '../../utils/authz'

/** Distinct work types already used — feeds the free-text "type" autocomplete suggestions. */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalInstallationWorks.view')

  const rows = await prisma.electricalInstallationWork.findMany({
    distinct: ['type'],
    select: { type: true },
    orderBy: { type: 'asc' },
  })

  return { types: rows.map((r) => r.type).filter(Boolean) }
})
