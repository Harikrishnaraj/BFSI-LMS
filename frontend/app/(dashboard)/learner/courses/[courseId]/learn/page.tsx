import { LearnView } from '@/components/learner/LearnView';

export default async function LearnPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <LearnView courseId={courseId} />;
}
