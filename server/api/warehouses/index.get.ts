import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeInactive = query.includeInactive === 'true'

  const warehouses = await prisma.warehouse.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: 'asc' },
  })

  return { warehouses }
})
