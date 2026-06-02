-- CreateTable
CREATE TABLE "supplier_prices" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_prices_productId_idx" ON "supplier_prices"("productId");

-- CreateIndex
CREATE INDEX "supplier_prices_contractorId_idx" ON "supplier_prices"("contractorId");

-- CreateIndex
CREATE INDEX "supplier_prices_isActive_idx" ON "supplier_prices"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_prices_contractorId_productId_validFrom_key" ON "supplier_prices"("contractorId", "productId", "validFrom");

-- AddForeignKey
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
