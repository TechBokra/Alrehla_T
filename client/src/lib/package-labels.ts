import type { AgeGroup, PackageTrack } from '@/types';

/**
 * أسماء الفئة العمرية والمسار — من مكان واحد (قرار تامر، ١ نوفمبر).
 *
 * ⚠️ المفاتيح في القاعدة لسه `under_12` / `12_plus` (تغييرها = ترحيل لكل
 *    الباقات والأطفال من غير فايدة للمستخدم). **الحد الفعلي ١٣ سنة**:
 *    `PACKAGE_AGE_CUTOFF` هنا و`child_age_group` في القاعدة لازم يتطابقوا.
 *
 * ⚠️ ده سن **الباقات** بس. سن الحماية والنشر في «أقلام» (١٢ سنة) قرار تاني
 *    ومالوش علاقة بالملف ده.
 */
export const PACKAGE_AGE_CUTOFF = 13;

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  under_12: 'دون 13 سنة',
  '12_plus': '13 سنة فما فوق',
};

export const TRACK_LABEL: Record<PackageTrack, string> = {
  foundation: 'مسار التأسيس الإبداعي',
  youth: 'مسار اليافعين والكبار',
  specialization: 'مسار التخصص الأدبي',
};

/** الاسم المختصر للجداول الضيقة. */
export const TRACK_SHORT: Record<PackageTrack, string> = {
  foundation: 'التأسيس الإبداعي',
  youth: 'اليافعين',
  specialization: 'التخصص الأدبي',
};
