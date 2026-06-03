-- Індивідуальні перевизначення дозволів поверх дефолтів ролі
ALTER TABLE "users" ADD COLUMN "permissionOverrides" JSONB NOT NULL DEFAULT '{}';
