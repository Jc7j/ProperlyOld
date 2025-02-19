/*
  Warnings:

  - You are about to drop the column `groups` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "groups";

-- CreateTable
CREATE TABLE "_GroupUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GroupUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GroupUsers_B_index" ON "_GroupUsers"("B");

-- AddForeignKey
ALTER TABLE "_GroupUsers" ADD CONSTRAINT "_GroupUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "ManagementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupUsers" ADD CONSTRAINT "_GroupUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
