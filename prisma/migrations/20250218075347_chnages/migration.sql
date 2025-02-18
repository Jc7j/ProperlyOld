/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `InvoiceItem` table. All the data in the column will be lost.
  - Added the required column `createdBy` to the `InvoiceItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `createdAt` on table `InvoiceItem` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "InvoiceItem" DROP COLUMN "updatedAt",
ADD COLUMN     "createdBy" TEXT NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL;
