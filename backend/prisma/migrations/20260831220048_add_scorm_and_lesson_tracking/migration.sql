-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('incomplete', 'completed', 'passed', 'failed');

-- CreateTable
CREATE TABLE "lesson_completions" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorm_packages" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "entry_point" TEXT NOT NULL,
    "duration" INTEGER,
    "manifest" JSONB NOT NULL,
    "original_name" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorm_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorm_sessions" (
    "id" UUID NOT NULL,
    "scorm_package_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorm_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorm_tracking" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "scorm_package_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "score" INTEGER,
    "completion_status" "CompletionStatus" NOT NULL DEFAULT 'incomplete',
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "interactions" JSONB NOT NULL DEFAULT '[]',
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorm_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_completions_enrollment_id_idx" ON "lesson_completions"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_completions_enrollment_id_content_id_key" ON "lesson_completions"("enrollment_id", "content_id");

-- CreateIndex
CREATE INDEX "scorm_packages_course_id_idx" ON "scorm_packages"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "scorm_sessions_token_key" ON "scorm_sessions"("token");

-- CreateIndex
CREATE INDEX "scorm_sessions_enrollment_id_idx" ON "scorm_sessions"("enrollment_id");

-- CreateIndex
CREATE INDEX "scorm_tracking_learner_id_idx" ON "scorm_tracking"("learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "scorm_tracking_enrollment_id_scorm_package_id_key" ON "scorm_tracking"("enrollment_id", "scorm_package_id");

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorm_packages" ADD CONSTRAINT "scorm_packages_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorm_sessions" ADD CONSTRAINT "scorm_sessions_scorm_package_id_fkey" FOREIGN KEY ("scorm_package_id") REFERENCES "scorm_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorm_sessions" ADD CONSTRAINT "scorm_sessions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorm_tracking" ADD CONSTRAINT "scorm_tracking_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorm_tracking" ADD CONSTRAINT "scorm_tracking_scorm_package_id_fkey" FOREIGN KEY ("scorm_package_id") REFERENCES "scorm_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

