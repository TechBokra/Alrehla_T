import type { QueryReadOptions } from '@/data/query-result';
import { createClient } from '@/lib/supabase/server';

export async function getStudentDocuments(studentId: string, options: QueryReadOptions = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('portfolio_documents')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error && options.throwOnError) throw error;
  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    studentId: d.student_id,
    title: d.title,
    content: d.content,
    status: d.status,
    instructorFeedback: d.instructor_feedback || undefined,
    updatedAt: d.updated_at || d.created_at
  }));
}

export async function getDocumentById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('portfolio_documents')
    .select('*')
    .eq('id', id)
    .single();

  if ((error || !data)) {
    return null;
  }

  return {
    id: data.id,
    studentId: data.student_id,
    title: data.title,
    content: data.content,
    status: data.status,
    instructorFeedback: data.instructor_feedback || undefined,
    updatedAt: data.updated_at || data.created_at
  };
}
