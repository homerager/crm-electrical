-- Rename electrical_panels -> electrical_installation_works (generalised "монтажні роботи")
ALTER TABLE "electrical_panels" RENAME TO "electrical_installation_works";
ALTER TABLE "electrical_installation_works" RENAME CONSTRAINT "electrical_panels_pkey" TO "electrical_installation_works_pkey";
ALTER INDEX "electrical_panels_objectId_idx" RENAME TO "electrical_installation_works_objectId_idx";
ALTER INDEX "electrical_panels_createdById_idx" RENAME TO "electrical_installation_works_createdById_idx";
ALTER TABLE "electrical_installation_works" RENAME CONSTRAINT "electrical_panels_objectId_fkey" TO "electrical_installation_works_objectId_fkey";
ALTER TABLE "electrical_installation_works" RENAME CONSTRAINT "electrical_panels_createdById_fkey" TO "electrical_installation_works_createdById_fkey";

-- New: work type (existing rows are all electrical panels)
ALTER TABLE "electrical_installation_works" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'Електрощит';

-- Rename electrical_panel_materials -> electrical_installation_work_materials, panelId -> workId
ALTER TABLE "electrical_panel_materials" RENAME TO "electrical_installation_work_materials";
ALTER TABLE "electrical_installation_work_materials" RENAME COLUMN "panelId" TO "workId";
ALTER TABLE "electrical_installation_work_materials" RENAME CONSTRAINT "electrical_panel_materials_pkey" TO "electrical_installation_work_materials_pkey";
ALTER INDEX "electrical_panel_materials_panelId_idx" RENAME TO "electrical_installation_work_materials_workId_idx";
ALTER TABLE "electrical_installation_work_materials" RENAME CONSTRAINT "electrical_panel_materials_panelId_fkey" TO "electrical_installation_work_materials_workId_fkey";
ALTER TABLE "electrical_installation_work_materials" RENAME CONSTRAINT "electrical_panel_materials_productId_fkey" TO "electrical_installation_work_materials_productId_fkey";
ALTER TABLE "electrical_installation_work_materials" RENAME CONSTRAINT "electrical_panel_materials_contractorId_fkey" TO "electrical_installation_work_materials_contractorId_fkey";
ALTER TABLE "electrical_installation_work_materials" RENAME CONSTRAINT "electrical_panel_materials_movementId_fkey" TO "electrical_installation_work_materials_movementId_fkey";
