ALTER TABLE "FeeType"
  ALTER COLUMN "amount" TYPE DECIMAL(14, 2)
  USING ROUND("amount"::numeric, 2);

ALTER TABLE "FeeInvoice"
  ALTER COLUMN "totalAmount" TYPE DECIMAL(14, 2)
  USING ROUND("totalAmount"::numeric, 2),
  ALTER COLUMN "paidAmount" DROP DEFAULT,
  ALTER COLUMN "paidAmount" TYPE DECIMAL(14, 2)
  USING ROUND("paidAmount"::numeric, 2),
  ALTER COLUMN "paidAmount" SET DEFAULT 0;

ALTER TABLE "FeeInvoiceItem"
  ALTER COLUMN "amount" TYPE DECIMAL(14, 2)
  USING ROUND("amount"::numeric, 2);

ALTER TABLE "FeePayment"
  ALTER COLUMN "amount" TYPE DECIMAL(14, 2)
  USING ROUND("amount"::numeric, 2);
