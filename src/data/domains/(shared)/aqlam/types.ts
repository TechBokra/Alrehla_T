import type { AgeBandId } from '@/lib/age-bands';
import type { AqlamCategory } from '@/lib/aqlam/post';

/** كارت نص في القوائم — من غير النص الكامل. */
export type AqlamPostCard = {
  id: string;
  title: string;
  excerpt: string;
  category: AqlamCategory | string;
  displayName: string;
  ageBand: AgeBandId | null;
  publishedAt: string | null;
  reactionCount: number;
  commentCount: number;
  featured: boolean;
};

export type AqlamPost = AqlamPostCard & {
  body: string;
  ageGroup: 'under_12' | '12_plus';
  allowIndexing: boolean;
  commentsEnabled: boolean;
  shareCardUrl: string | null;
  /** آخر تعديل بعد النشر (null = ما اتعدّلش). */
  editedAt: string | null;
  /** رابط صفحة الكاتب لو اختارها (غير كده null). */
  writerSlug: string | null;
};

/** صفحة كاتب اختار يظهر. من غير أي بيانات حساب. */
export type AqlamPublicWriter = {
  slug: string;
  name: string;
  bio: string;
  ageBand: AgeBandId | null;
  postsCount: number;
};

export type AqlamPublicComment = {
  id: string;
  authorDisplayName: string;
  isInstructor: boolean;
  body: string;
  createdAt: string;
};

export type AqlamSort = 'new' | 'top';

export const AQLAM_PAGE_SIZE = 12;
