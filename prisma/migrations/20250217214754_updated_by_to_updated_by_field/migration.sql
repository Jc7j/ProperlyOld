/*
  Warnings:

  - You are about to drop the column `UpdatedBy` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedBy` on the `ManagementGroupItems` table. All the data in the column will be lost.
  - Added the required column `updatedBy` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `ManagementGroupItems` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "UpdatedBy",
ADD COLUMN     "updatedBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ManagementGroupItems" DROP COLUMN "UpdatedBy",
ADD COLUMN     "updatedBy" TEXT NOT NULL;
