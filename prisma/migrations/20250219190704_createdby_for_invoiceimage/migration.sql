/*
  Warnings:

  - Added the required column `createdBy` to the `InvoiceImage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InvoiceImage" ADD COLUMN     "createdBy" TEXT NOT NULL;
