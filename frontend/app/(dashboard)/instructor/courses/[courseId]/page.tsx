import { redirect } from 'next/navigation';
import { dashboardPathFor, getRole } from '@/lib/auth';
import { CourseEditor } from '@/components/instructor/CourseEditor';

export default async function CourseEditorPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const role = await getRole();
  if (role !== 'instructor' && role !== 'admin') redirect(dashboardPathFor(role));

  const { courseId } = await params;
  return <CourseEditor courseId={courseId} />;
}
