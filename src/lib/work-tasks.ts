/**
 * توزيع الطلبات على المسؤولين (ملف 14) — الثوابت المشتركة.
 */
export type WorkLine = 'enha_lak' | 'box' | 'courses' | 'services';
export type WorkStage = 'payment' | 'fulfilment';

export const WORK_LINES: WorkLine[] = ['enha_lak', 'box', 'courses', 'services'];
export const WORK_STAGES: WorkStage[] = ['payment', 'fulfilment'];

export const WORK_LINE_LABELS: Record<WorkLine, string> = {
  enha_lak: '«إنها لك» (قصص ومكتبة)',
  box: 'صندوق الرحلة',
  courses: 'حجوزات «بداية الرحلة»',
  services: 'الخدمات الإبداعية',
};

export const WORK_STAGE_LABELS: Record<WorkStage, string> = {
  payment: 'مراجعة الدفع',
  fulfilment: 'التنفيذ',
};

export const WORK_STAGE_HINTS: Record<WorkStage, string> = {
  payment: 'أول ما العميل يرفع الإيصال — يتأكد من التحويل ويأكد الدفع.',
  fulfilment: 'بعد تأكيد الدفع — التجهيز والشحن، أو تعيين المدرب والجدولة، أو متابعة مقدّم الخدمة.',
};

export function isWorkLine(v: unknown): v is WorkLine {
  return typeof v === 'string' && (WORK_LINES as string[]).includes(v);
}
export function isWorkStage(v: unknown): v is WorkStage {
  return typeof v === 'string' && (WORK_STAGES as string[]).includes(v);
}
