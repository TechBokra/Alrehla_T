/**
 * شهادات إتمام «بداية الرحلة» (ملف 20261107120000).
 *
 * المسار: «بانتظار الإصدار» ← «صدرت» (رقمية جاهزة لولي الأمر) ← ولو طلب
 * نسخة ورقية: «طباعة» ← «في الشحن» ← «اتسلّمت». كل مرحلة شغل مهمة في
 * «مهامي» (المسار certificates)، وكل تغيير بدالة في القاعدة بتتأكد من
 * الصلاحية والحالة — الشاشة مابتكتبش في الجدول مباشرة.
 */

export type CertificateStatus = 'pending' | 'issued' | 'print_requested' | 'shipped' | 'delivered';

export const CERTIFICATE_STATUSES: CertificateStatus[] = ['pending', 'issued', 'print_requested', 'shipped', 'delivered'];

/** للإدارة. */
export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  pending: 'بانتظار الإصدار',
  issued: 'صدرت (رقمية)',
  print_requested: 'مطلوب نسخة ورقية — طباعة',
  shipped: 'في الشحن',
  delivered: 'اتسلّمت',
};

/** لولي الأمر. */
export const CERTIFICATE_PARENT_LABELS: Record<CertificateStatus, string> = {
  pending: 'بنجهّزها',
  issued: 'جاهزة',
  print_requested: 'النسخة الورقية بتتطبع',
  shipped: 'النسخة الورقية في الطريق',
  delivered: 'النسخة الورقية اتسلّمت',
};

export function isCertificateStatus(v: unknown): v is CertificateStatus {
  return typeof v === 'string' && (CERTIFICATE_STATUSES as string[]).includes(v);
}

/** الشهادة الرقمية بتتفتح من أول ما تصدر. */
export function certificateViewable(status: CertificateStatus): boolean {
  return status !== 'pending';
}

export type PaperRequestInput = {
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  city: string;
  governorate: string;
  notes: string;
};

/** نفس فحص `course_certificate_request_paper` — الرسالة على الخانة قبل ما القاعدة ترفض. */
export function paperRequestProblem(i: PaperRequestInput): { field: keyof PaperRequestInput; message: string } | null {
  if (i.recipientName.trim().length < 2) return { field: 'recipientName', message: 'اكتب اسم المستلم' };
  if (i.recipientPhone.replace(/\D/g, '').length < 8) return { field: 'recipientPhone', message: 'اكتب رقم موبايل صحيح' };
  if (i.addressLine.trim().length < 5) return { field: 'addressLine', message: 'اكتب العنوان بالتفصيل' };
  if (i.city.trim().length < 2) return { field: 'city', message: 'اكتب المدينة' };
  if (i.governorate.trim().length < 2) return { field: 'governorate', message: 'اكتب المحافظة' };
  if (i.notes.length > 300) return { field: 'notes', message: 'الملاحظات طويلة — ٣٠٠ حرف على الأكتر' };
  return null;
}

/** اسم المشارك كما سيُطبع (نفس قيد الجدول: ٢–٨٠ حرف). */
export function participantNameProblem(name: string): string | null {
  const n = name.trim();
  if (n.length < 2 || n.length > 80) return 'اكتب اسم المشارك كما سيظهر في الشهادة (من ٢ لـ ٨٠ حرف)';
  return null;
}
