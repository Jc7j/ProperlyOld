-- CreateIndex
CREATE INDEX "OwnerStatement_managementGroupId_statementMonth_deletedAt_idx" ON "OwnerStatement"("managementGroupId", "statementMonth", "deletedAt");

-- CreateIndex
CREATE INDEX "OwnerStatement_propertyId_statementMonth_idx" ON "OwnerStatement"("propertyId", "statementMonth");

-- CreateIndex
CREATE INDEX "OwnerStatement_statementMonth_deletedAt_idx" ON "OwnerStatement"("statementMonth", "deletedAt");

-- CreateIndex
CREATE INDEX "OwnerStatementAdjustment_ownerStatementId_idx" ON "OwnerStatementAdjustment"("ownerStatementId");

-- CreateIndex
CREATE INDEX "OwnerStatementExpense_ownerStatementId_idx" ON "OwnerStatementExpense"("ownerStatementId");

-- CreateIndex
CREATE INDEX "OwnerStatementExpense_vendor_description_idx" ON "OwnerStatementExpense"("vendor", "description");

-- CreateIndex
CREATE INDEX "OwnerStatementExpense_date_idx" ON "OwnerStatementExpense"("date");

-- CreateIndex
CREATE INDEX "OwnerStatementIncome_ownerStatementId_idx" ON "OwnerStatementIncome"("ownerStatementId");

-- CreateIndex
CREATE INDEX "Property_managementGroupId_deletedAt_idx" ON "Property"("managementGroupId", "deletedAt");

-- CreateIndex
CREATE INDEX "Property_name_managementGroupId_idx" ON "Property"("name", "managementGroupId");
