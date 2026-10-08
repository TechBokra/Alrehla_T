import { Instructor, WeeklySlot } from '@/types';

export interface ChangeSummaryItem {
  iconType: 'packages' | 'schedule' | 'workModel' | 'price' | 'profile';
  title: string;
  detail: string;
  badge?: string;
}

export function getInstructorChangeItems(
  changes: Partial<Instructor & { packageIds?: string[]; _requestType?: string }>,
  allPackages?: { id: string; name: string }[]
): ChangeSummaryItem[] {
  const items: ChangeSummaryItem[] = [];

  // 1. باقات التدريب
  if (changes.packageIds !== undefined) {
    const pkgIds = changes.packageIds;
    let detail = '';
    if (pkgIds.length === 0) {
      detail = 'طلب اعتماد التدريب في جميع الباقات المتاحة بالمنصة (بلا تقييد).';
    } else {
      const names = pkgIds.map(
        (id) => allPackages?.find((p) => p.id === id)?.name || id
      );
      detail = `طلب اعتماد التدريب في ${pkgIds.length} باقة: (${names.join('، ')}).`;
    }
    items.push({
      iconType: 'packages',
      title: 'باقات التدريب',
      detail,
      badge: pkgIds.length === 0 ? 'كل الباقات' : `${pkgIds.length} باقة`,
    });
  }

  // 2. الجدول الأسبوعي
  if (changes.weeklySchedule !== undefined) {
    const slots = (changes.weeklySchedule as WeeklySlot[]) || [];
    const total = slots.length;
    const tempSlots = slots.filter((s) => s.commitmentType === 'fixed_term');
    const ongoingCount = total - tempSlots.length;
    let detail = `تحديث الجدول الأسبوعي: إجمالي ${total} موعد (${ongoingCount} دائم مستمر`;
    if (tempSlots.length > 0) {
      const endDates = tempSlots
        .map((s) => s.commitmentEndsAt)
        .filter(Boolean)
        .slice(0, 2);
      detail += `، و ${tempSlots.length} موعد مؤقت${endDates.length > 0 ? ` ينتهي في ${endDates.join(' و ')}` : ''}`;
    }
    detail += ').';

    items.push({
      iconType: 'schedule',
      title: 'الجدول الأسبوعي والمواعيد',
      detail,
      badge: `${total} موعد أسبوعياً`,
    });
  }

  // 3. نظام العمل
  if (changes.workModel !== undefined) {
    const isMonthly = changes.workModel === 'monthly';
    const detail = isMonthly
      ? `تغيير نظام العمل إلى راتب شهري (${changes.monthlyHoursCommitted || 60} ساعة التزام شهرياً - تواصل مباشر مع الإدارة).`
      : 'تغيير نظام العمل إلى نظام العمل بالجلسة.';
    items.push({
      iconType: 'workModel',
      title: 'نظام العمل',
      detail,
      badge: isMonthly ? 'راتب شهري' : 'بالجلسة',
    });
  }

  // 4. حصيلة الجلسة
  if (changes.workModel !== 'monthly' && changes.requestedPrice !== undefined) {
    items.push({
      iconType: 'price',
      title: 'حصيلة الجلسة',
      detail: `تحديد حصيلة الجلسة المطلوبة للمدرب بقيمة: ${changes.requestedPrice} ج.م`,
      badge: `${changes.requestedPrice} ج.م`,
    });
  }

  // 5. حقول الملف الشخصي
  const profileEdits: string[] = [];
  if (changes.displayName !== undefined) profileEdits.push(`الاسم: "${changes.displayName}"`);
  if (changes.bio !== undefined) profileEdits.push('النبذة التعريفية');
  if (changes.specialties !== undefined) profileEdits.push(`التخصصات (${changes.specialties.join('، ')})`);
  if (changes.yearsExperience !== undefined) profileEdits.push(`سنوات الخبرة (${changes.yearsExperience} سنوات)`);
  if (changes.avatarUrl !== undefined) profileEdits.push('صورة شخصية جديدة');

  if (profileEdits.length > 0) {
    items.push({
      iconType: 'profile',
      title: 'البيانات الشخصية والملف',
      detail: `تعديل: ${profileEdits.join(' • ')}`,
      badge: `${profileEdits.length} حقول`,
    });
  }

  return items;
}

export function summarizeInstructorChangesText(
  changes: Partial<Instructor & { packageIds?: string[]; _requestType?: string }>,
  allPackages?: { id: string; name: string }[]
): string {
  const items = getInstructorChangeItems(changes, allPackages);
  if (items.length === 0) return 'طلب مراجعة وتحديث ملف مدرب';
  return items.map((i) => `${i.title}: ${i.detail}`).join(' | ');
}
