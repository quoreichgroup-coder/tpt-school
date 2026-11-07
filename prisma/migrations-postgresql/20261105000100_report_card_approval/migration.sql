ALTER TABLE "ReportCard"
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT;

-- Existing published cards were already visible to families, so retain that state.
UPDATE "ReportCard"
SET "approvalStatus" = CASE WHEN "published" THEN 'approved' ELSE 'draft' END,
    "reviewedAt" = CASE WHEN "published" THEN "issuedAt" ELSE NULL END;

ALTER TABLE "ReportCard"
  ADD CONSTRAINT "ReportCard_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
