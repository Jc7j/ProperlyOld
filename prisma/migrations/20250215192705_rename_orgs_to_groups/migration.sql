/*
  Warnings:

  - You are about to drop the column `orgs` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "orgs",
ADD COLUMN     "groups" JSONB;
