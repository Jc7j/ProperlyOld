/*
  Warnings:

  - You are about to drop the `_GroupUsers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_GroupUsers" DROP CONSTRAINT "_GroupUsers_A_fkey";

-- DropForeignKey
ALTER TABLE "_GroupUsers" DROP CONSTRAINT "_GroupUsers_B_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "groups" JSONB;

-- DropTable
DROP TABLE "_GroupUsers";
