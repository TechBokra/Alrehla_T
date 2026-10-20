import { InstructorCertification } from '@/types';
import { createClient } from '@/lib/supabase/server';

export async function getInstructorCertification(
  instructorId: string
): Promise<InstructorCertification | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_certifications')
    .select('*')
    .eq('instructor_id', instructorId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    instructorId: data.instructor_id,
    trainingCompletedAt: data.training_completed_at ?? undefined,
    trainingMeetingLink: data.training_meeting_link ?? undefined,
    examPassed: data.exam_passed,
    examScore: data.exam_score ?? undefined,
    certifiedAt: data.certified_at ?? undefined,
  };
}
