-- CreateEnum
CREATE TYPE "DocumentJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'FILL_BLANK', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "documents"
ADD COLUMN "extracted_text" TEXT,
ADD COLUMN "character_count" INTEGER,
ADD COLUMN "page_count" INTEGER,
ADD COLUMN "processing_error_code" TEXT,
ADD COLUMN "processing_error_message" TEXT;

-- CreateTable
CREATE TABLE "document_jobs" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "status" "DocumentJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "active_key" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "generation_job_id" TEXT NOT NULL,
  "type" "QuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB,
  "correct_answer" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "difficulty" "QuestionDifficulty" NOT NULL,
  "review_status" "QuestionReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_revisions" (
  "id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "editor_id" TEXT NOT NULL,
  "previous_values" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_jobs_active_key_key" ON "document_jobs"("active_key");
CREATE INDEX "document_jobs_document_id_created_at_idx" ON "document_jobs"("document_id", "created_at");
CREATE INDEX "document_jobs_status_created_at_idx" ON "document_jobs"("status", "created_at");
CREATE INDEX "questions_document_id_review_status_created_at_idx" ON "questions"("document_id", "review_status", "created_at");
CREATE INDEX "question_revisions_question_id_created_at_idx" ON "question_revisions"("question_id", "created_at");
CREATE INDEX "question_revisions_editor_id_idx" ON "question_revisions"("editor_id");

-- AddForeignKey
ALTER TABLE "document_jobs" ADD CONSTRAINT "document_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "document_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
