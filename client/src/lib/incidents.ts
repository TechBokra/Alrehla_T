/**
 * بلاغات الجلسات — قرار تامر (٢٤ أكتوبر، بند ١١).
 *
 * درجتين: **عادي**، و**عاجل** لو فيه خطر على الطفل أو الموقف خرج عن
 * السيطرة. العاجل بيوصل للإدارة فورًا ويظهر أحمر فوق لوحة الإدارة لحد
 * ما حد يمسكه.
 *
 * ⚠️ «سلامة الطفل» **دايمًا عاجل** — حتى لو المُبلّغ اختار «عادي».
 *    ده مش قرار المُبلّغ: اللي شاف علامة خطر ممكن يقلّل منها عشان
 *    مش متأكد، والتأخير هنا تمنه أغلى من إنذار زيادة.
 */

export type IncidentCategory = 'child_safety' | 'conduct' | 'session_control' | 'technical' | 'other';
export type IncidentSeverity = 'normal' | 'urgent';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved';

export const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string; hint: string }[] = [
  { value: 'child_safety', label: 'سلامة الطفل', hint: 'علامة خطر أو أذى على الطفل — بيتعامل كعاجل دايمًا.' },
  { value: 'conduct', label: 'سلوك غير لائق', hint: 'كلام أو تصرّف مش مناسب من أي طرف.' },
  { value: 'session_control', label: 'الجلسة خرجت عن السيطرة', hint: 'المدرب أو الطالب مش قادر يكمّل الجلسة بشكل طبيعي.' },
  { value: 'technical', label: 'مشكلة تقنية', hint: 'الغرفة، الصوت، الصورة، الدخول.' },
  { value: 'other', label: 'حاجة تانية', hint: '' },
];

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'جديد',
  in_progress: 'جاري التعامل',
  resolved: 'اتحلّ',
};

export function categoryLabel(c: string): string {
  return INCIDENT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export type IncidentInput = {
  category: string;
  severity: string;
  description: string;
};

export type IncidentCheck =
  | { ok: true; category: IncidentCategory; severity: IncidentSeverity; description: string }
  | { ok: false; error: string; field?: 'category' | 'description' };

export function validateIncident(input: IncidentInput): IncidentCheck {
  const category = INCIDENT_CATEGORIES.find((c) => c.value === input.category)?.value;
  if (!category) return { ok: false, error: 'اختار نوع المشكلة', field: 'category' };
  const description = String(input.description ?? '').trim();
  if (description.length < 10) {
    return { ok: false, error: 'اكتب اللي حصل في سطر أو اتنين على الأقل', field: 'description' };
  }
  if (description.length > 4000) return { ok: false, error: 'الوصف طويل أوي', field: 'description' };
  const severity: IncidentSeverity =
    category === 'child_safety' || input.severity === 'urgent' ? 'urgent' : 'normal';
  return { ok: true, category, severity, description };
}
