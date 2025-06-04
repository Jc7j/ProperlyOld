-- DropForeignKey
ALTER TABLE "OwnerStatementAdjustment" DROP CONSTRAINT "OwnerStatementAdjustment_ownerStatementId_fkey";

-- DropForeignKey
ALTER TABLE "OwnerStatementExpense" DROP CONSTRAINT "OwnerStatementExpense_ownerStatementId_fkey";

-- DropForeignKey
ALTER TABLE "OwnerStatementIncome" DROP CONSTRAINT "OwnerStatementIncome_ownerStatementId_fkey";

-- AddForeignKey
ALTER TABLE "OwnerStatementIncome" ADD CONSTRAINT "OwnerStatementIncome_ownerStatementId_fkey" FOREIGN KEY ("ownerStatementId") REFERENCES "OwnerStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementExpense" ADD CONSTRAINT "OwnerStatementExpense_ownerStatementId_fkey" FOREIGN KEY ("ownerStatementId") REFERENCES "OwnerStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementAdjustment" ADD CONSTRAINT "OwnerStatementAdjustment_ownerStatementId_fkey" FOREIGN KEY ("ownerStatementId") REFERENCES "OwnerStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
