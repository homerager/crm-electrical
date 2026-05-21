import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Backfill ConstructionObject.projectId from existing Task relationships.
 *
 * For each object that has tasks with a projectId, sets object.projectId
 * to the most common projectId found among its tasks.
 *
 * Safe to run multiple times — skips objects that already have a projectId.
 *
 * Usage: npx tsx prisma/backfill-object-project.ts
 */
async function main() {
  // Find the most common projectId per objectId from tasks,
  // only for objects that don't have a projectId yet.
  const rows = await prisma.$queryRaw<
    { objectId: string; projectId: string; cnt: bigint }[]
  >`
    SELECT t."objectId", t."projectId", COUNT(*) AS cnt
    FROM tasks t
    JOIN construction_objects co ON co.id = t."objectId"
    WHERE t."objectId" IS NOT NULL
      AND t."projectId" IS NOT NULL
      AND co."projectId" IS NULL
    GROUP BY t."objectId", t."projectId"
    ORDER BY t."objectId", cnt DESC
  `

  // Pick the projectId with the highest count for each object
  const bestByObject = new Map<string, string>()
  for (const row of rows) {
    if (!bestByObject.has(row.objectId)) {
      bestByObject.set(row.objectId, row.projectId)
    }
  }

  if (bestByObject.size === 0) {
    console.log('Nothing to backfill — all objects already have a projectId or no tasks link them.')
    return
  }

  console.log(`Backfilling projectId for ${bestByObject.size} object(s)…`)

  let updated = 0
  for (const [objectId, projectId] of bestByObject) {
    await prisma.constructionObject.update({
      where: { id: objectId },
      data: { projectId },
    })
    updated++
    console.log(`  [${updated}/${bestByObject.size}] object ${objectId} → project ${projectId}`)
  }

  console.log(`Done. Updated ${updated} object(s).`)
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
