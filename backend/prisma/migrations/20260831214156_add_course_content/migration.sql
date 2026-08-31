-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('video', 'pdf', 'richtext', 'scorm');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "time_spent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "course_content" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT,
    "content_text" TEXT,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_content_course_id_idx" ON "course_content"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_content_course_id_order_index_key" ON "course_content"("course_id", "order_index");

-- CreateIndex
CREATE INDEX "courses_category_idx" ON "courses"("category");

-- AddForeignKey
ALTER TABLE "course_content" ADD CONSTRAINT "course_content_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

