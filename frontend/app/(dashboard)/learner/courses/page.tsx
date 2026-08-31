import { BrowseCourses } from '@/components/learner/BrowseCourses';

export default function BrowseCoursesPage() {
  // Any signed-in role may browse; the API decides what they can see.
  return <BrowseCourses />;
}
