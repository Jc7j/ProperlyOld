-- AlterTable
ALTER TABLE "OwnerStatementAdjustment" ALTER COLUMN "checkIn" SET DATA TYPE TEXT,
ALTER COLUMN "checkOut" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "OwnerStatementExpense" ALTER COLUMN "date" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "OwnerStatementIncome" ALTER COLUMN "checkIn" SET DATA TYPE TEXT,
ALTER COLUMN "checkOut" SET DATA TYPE TEXT;
