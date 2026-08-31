import { redirect } from 'next/navigation';
import { dashboardPathFor, getRole } from '@/lib/auth';
import { CourseListView } from '@/components/instructor/CourseListView';

export default async function InstructorCoursesPage() {
  const role = await getRole();
  if (role !== 'instructor' && role !== 'admin') redirect(dashboardPathFor(role));

  return <CourseListView />;
}
