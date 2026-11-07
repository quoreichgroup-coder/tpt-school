ALTER TABLE "ReportCard"
  ADD COLUMN "reviewedById" TEXT,
  ADD CONSTRAINT "ReportCard_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReportCardRevision" (
  "id" TEXT NOT NULL,
  "reportCardId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "academicYear" INTEGER NOT NULL,
  "comments" TEXT,
  "teacherNotes" TEXT,
  "principalNotes" TEXT,
  "approvalStatus" TEXT NOT NULL,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportCardRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportCardRevision_reportCardId_fkey"
    FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReportCardRevision_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ReportCardRevision_reportCardId_createdAt_idx"
  ON "ReportCardRevision"("reportCardId", "createdAt");
