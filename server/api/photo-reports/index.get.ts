import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const query = getQuery(event)
  const objectId = query.objectId as string | undefined

  const where: any = {}
  if (objectId) where.objectId = objectId

  if (!isElevatedRole(auth.role)) {
    where.createdById = auth.userId
  }

  const reports = await prisma.photoReport.findMany({
    where,
    include: {
      object: { select: { id: true, name: true, address: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { photos: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { reports }
})
