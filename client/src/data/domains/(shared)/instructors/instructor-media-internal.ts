import type { InstructorMedia, InstructorMediaKind, InstructorMediaStatus } from '@/data/domains/(shared)/instructors/media-types';

type Row = {
  id: string;
  instructor_id: string;
  kind: string;
  image_url: string;
  title: string | null;
  contribution: string | null;
  sort_order: number;
  status: string;
  admin_feedback: string | null;
  created_at: string;
};

export const toMedia = (r: Row): InstructorMedia => ({
  id: r.id,
  instructorId: r.instructor_id,
  kind: r.kind as InstructorMediaKind,
  imageUrl: r.image_url,
  title: r.title,
  contribution: r.contribution,
  sortOrder: r.sort_order,
  status: r.status as InstructorMediaStatus,
  adminFeedback: r.admin_feedback,
  createdAt: r.created_at,
});

export const COLUMNS =
  'id, instructor_id, kind, image_url, title, contribution, sort_order, status, admin_feedback, created_at';
