CREATE TABLE "Exam" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "roomId" TEXT,
  "invigilatorId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "gradebookId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Exam_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Exam_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Exam_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Exam_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Exam_gradebookId_fkey" FOREIGN KEY ("gradebookId") REFERENCES "Gradebook"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Exam_gradebookId_key" ON "Exam"("gradebookId");
CREATE INDEX "Exam_classId_startsAt_idx" ON "Exam"("classId", "startsAt");
CREATE INDEX "Exam_termId_status_startsAt_idx" ON "Exam"("termId", "status", "startsAt");
CREATE INDEX "Exam_roomId_startsAt_idx" ON "Exam"("roomId", "startsAt");
CREATE INDEX "Exam_invigilatorId_startsAt_idx" ON "Exam"("invigilatorId", "startsAt");
