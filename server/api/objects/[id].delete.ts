import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  const obj = await prisma.constructionObject.findUnique({ where: { id } })
  await prisma.constructionObject.delete({ where: { id } })

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'DELETE', entityType: 'ConstructionObject', entityId: id, changes: { name: obj?.name } })

  return { ok: true }
})
