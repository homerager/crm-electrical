export default defineEventHandler(async () => {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } })
  return { settings: settings ?? null }
})
