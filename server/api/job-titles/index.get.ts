import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')

  const jobTitles = await prisma.jobTitle.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return { jobTitles }
})
