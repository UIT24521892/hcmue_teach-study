-- CreateTable
CREATE TABLE "daily_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "understanding" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_note_tags" (
    "note_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "daily_note_tags_pkey" PRIMARY KEY ("note_id","tag_id")
);

-- CreateTable
CREATE TABLE "daily_note_links" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "document_id" TEXT,
    "attempt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_note_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_notes_user_id_date_key" ON "daily_notes"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_normalized_key" ON "tags"("user_id", "normalized");

-- CreateIndex
CREATE INDEX "daily_note_tags_tag_id_idx" ON "daily_note_tags"("tag_id");

-- CreateIndex
CREATE INDEX "daily_note_links_document_id_idx" ON "daily_note_links"("document_id");

-- CreateIndex
CREATE INDEX "daily_note_links_attempt_id_idx" ON "daily_note_links"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_note_links_note_id_document_id_key" ON "daily_note_links"("note_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_note_links_note_id_attempt_id_key" ON "daily_note_links"("note_id", "attempt_id");

-- AddForeignKey
ALTER TABLE "daily_notes" ADD CONSTRAINT "daily_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_note_tags" ADD CONSTRAINT "daily_note_tags_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "daily_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_note_tags" ADD CONSTRAINT "daily_note_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_note_links" ADD CONSTRAINT "daily_note_links_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "daily_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_note_links" ADD CONSTRAINT "daily_note_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_note_links" ADD CONSTRAINT "daily_note_links_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A link points at exactly one target.
ALTER TABLE "daily_note_links" ADD CONSTRAINT "daily_note_links_one_target_check"
  CHECK (num_nonnulls("document_id", "attempt_id") = 1);

-- Self-assessment scale used by the journal UI.
ALTER TABLE "daily_notes" ADD CONSTRAINT "daily_notes_understanding_check"
  CHECK ("understanding" BETWEEN 1 AND 3);
