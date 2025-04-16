-- CreateTable
CREATE TABLE "OwnerStatement" (
    "id" TEXT NOT NULL,
    "managementGroupId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "statementMonth" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "totalIncome" DECIMAL(65,30),
    "totalExpenses" DECIMAL(65,30),
    "totalAdjustments" DECIMAL(65,30),
    "grandTotal" DECIMAL(65,30),

    CONSTRAINT "OwnerStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerStatementIncome" (
    "id" TEXT NOT NULL,
    "ownerStatementId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "guest" TEXT NOT NULL,
    "grossRevenue" DECIMAL(65,30) NOT NULL,
    "hostFee" DECIMAL(65,30) NOT NULL,
    "platformFee" DECIMAL(65,30) NOT NULL,
    "grossIncome" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OwnerStatementIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerStatementExpense" (
    "id" TEXT NOT NULL,
    "ownerStatementId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OwnerStatementExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerStatementAdjustment" (
    "id" TEXT NOT NULL,
    "ownerStatementId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OwnerStatementAdjustment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_managementGroupId_fkey" FOREIGN KEY ("managementGroupId") REFERENCES "ManagementGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementIncome" ADD CONSTRAINT "OwnerStatementIncome_ownerStatementId_fkey" FOREIGN KEY ("ownerStatementId") REFERENCES "OwnerStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementExpense" ADD CONSTRAINT "OwnerStatementExpense_ownerStatementId_fkey" FOREIGN KEY ("ownerStatementId") REFERENCES "OwnerStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementAdjustment" ADD CONSTRAINT "OwnerStatementAdjustment_ownerStatementId_fkey" FOREIGN KEY ("ownerStatementId") REFERENCES "OwnerStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
