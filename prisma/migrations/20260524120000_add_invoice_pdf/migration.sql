-- AddColumn
ALTER TABLE "invoices" ADD COLUMN "pdfStoredAs" TEXT;
ALTER TABLE "invoices" ADD COLUMN "pdfFilename" TEXT;
ALTER TABLE "invoices" ADD COLUMN "pdfMimeType" TEXT;
ALTER TABLE "invoices" ADD COLUMN "pdfSize" INTEGER;
