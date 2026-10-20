

/**
 * صور بروفايل المدرب — غلاف وأعمال، بموافقة الإدارة (ملف 127).
 */

export type InstructorMediaKind = 'cover' | 'work';

export type InstructorMediaStatus = 'pending' | 'approved' | 'rejected';

export interface InstructorMedia {
  id: string;
  instructorId: string;
  kind: InstructorMediaKind;
  imageUrl: string;
  title: string | null;
  contribution: string | null;
  sortOrder: number;
  status: InstructorMediaStatus;
  adminFeedback: string | null;
  createdAt: string;
}

/**
 * كل اللي مستني مراجعة لكل مدرب — **ملفه وصوره في مكان واحد**.
 *
 * المدرب بيعدّل ملفه وصوره من صفحة واحدة («ملفي وصوري»)، فالإدارة
 * بتراجعهم من صفحة واحدة برضه: طلبات تعديل الملف (نبذة، تخصصات،
 * جدول، باقات…) والغلاف وصور الأعمال، متجمّعين بالمدرب، ومع كل مدرب
 * بياناته الحالية عشان المقارنة «قبل ← بعد».
 */
export type InstructorReviewGroup = {
  instructorId: string;
  displayName: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  status: string;
  avatarUrl: string | null;
  requests: {
    id: string;
    createdAt: string;
    requestedChanges: Record<string, unknown>;
  }[];
  media: InstructorMedia[];
};
