/*
  Warnings:

  - You are about to drop the column `itemId` on the `InvoiceItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InvoiceItem" DROP COLUMN "itemId",
ADD COLUMN     "managementGroupItemsId" TEXT;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_managementGroupItemsId_fkey" FOREIGN KEY ("managementGroupItemsId") REFERENCES "ManagementGroupItems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
