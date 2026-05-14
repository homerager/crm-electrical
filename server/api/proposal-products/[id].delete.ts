export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await prisma.proposalProduct.delete({ where: { id } })
  return { ok: true }
})
