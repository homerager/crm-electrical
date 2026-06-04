import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  await requirePermission(event, 'settings.manage')

  const id = getRouterParam(event, 'id')!
  await prisma.requisite.delete({ where: { id } })
  return { ok: true }
})
