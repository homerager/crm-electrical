import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const contractors = await prisma.contractor.findMany({
    orderBy: { name: 'asc' },
  })
  return { contractors }
})
