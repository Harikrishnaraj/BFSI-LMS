-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('assigned', 'in_progress', 'completed', 'overdue');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "request_id" TEXT;

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'assigned',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrollments_course_id_status_idx" ON "enrollments"("course_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_status_due_at_idx" ON "enrollments"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_course_id_key" ON "enrollments"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "certificates_expires_at_idx" ON "certificates"("expires_at");

-- CreateIndex
CREATE INDEX "certificates_user_id_idx" ON "certificates"("user_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

