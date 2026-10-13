import { Instructor } from '@/types';

/**
 * صفوف شاشة إدارة المدربين.
 *
 * الشاشة محتاجة معلومات من ثلاث جداول: المدرب نفسه، هل عنده طلب مراجعة
 * معلّق، وهل مشترك في خدمات إبداعية معتمدة. بنجيبهم في ثلاث استعلامات
 * مجمّعة بدل استعلام لكل مدرب (اللي كان هيبقى 200 استعلام لـ200 مدرب).
 */
export interface InstructorAdminRow extends Instructor {
  hasPendingReview: boolean;
  activeServicesCount: number;
}
