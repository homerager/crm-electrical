import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 12)
  const storekeeperPassword = await bcrypt.hash('store123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.com' },
    update: {},
    create: {
      name: 'Адміністратор',
      email: 'admin@crm.com',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  })

  const storekeeper = await prisma.user.upsert({
    where: { email: 'storekeeper@crm.com' },
    update: {},
    create: {
      name: 'Комірник',
      email: 'storekeeper@crm.com',
      passwordHash: storekeeperPassword,
      role: Role.STOREKEEPER,
    },
  })

  const warehouse1 = await prisma.warehouse.upsert({
    where: { id: 'warehouse-1' },
    update: {},
    create: {
      id: 'warehouse-1',
      name: 'Головний склад',
      address: 'вул. Промислова 1, Київ',
      description: 'Основний склад компанії',
    },
  })

  const warehouse2 = await prisma.warehouse.upsert({
    where: { id: 'warehouse-2' },
    update: {},
    create: {
      id: 'warehouse-2',
      name: 'Склад №2',
      address: 'вул. Заводська 5, Київ',
      description: 'Додатковий склад',
    },
  })

  console.log('Seed completed:', { admin, storekeeper, warehouse1, warehouse2 })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
