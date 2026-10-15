/**
 * توزيع الطلبات على المسؤولين (ملف 14) — الثوابت المشتركة.
 */
export type WorkLine = 'enha_lak' | 'box' | 'courses' | 'services' | 'studio';
export type WorkStage = 'payment' | 'fulfilment';

export const WORK_LINES: WorkLine[] = ['enha_lak', 'box', 'courses', 'services', 'studio'];
export const WORK_STAGES: WorkStage[] = ['payment', 'fulfilment'];

export const WORK_LINE_LABELS: Record<WorkLine, string> = {
  enha_lak: '«إنها لك» (قصص ومكتبة)',
  box: 'صندوق الرحلة',
  courses: 'حجوزات «بداية الرحلة»',
  services: 'الخدمات الإبداعية',
  studio: 'استوديو القصص (التأليف والرسم)',
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

/**
 * المراحل اللي بتتعمل فعلًا لكل نوع. استوديو القصص مهمته **مهمة واحدة لكل
 * مشروع** (مرحلة التنفيذ) وصاحبها بيتغيّر مع مرحلة المشروع — مفيش «مراجعة دفع»
 * لأنها مهمة الطلب نفسه (خط «إنها لك»).
 */
export const WORK_LINE_STAGES: Record<WorkLine, WorkStage[]> = {
  enha_lak: ['payment', 'fulfilment'],
  box: ['payment', 'fulfilment'],
  courses: ['payment', 'fulfilment'],
  services: ['payment', 'fulfilment'],
  studio: ['fulfilment'],
};

export function isStageOfLine(line: WorkLine, stage: WorkStage): boolean {
  return WORK_LINE_STAGES[line].includes(stage);
}

/** سطر الشرح تحت المرحلة — الاستوديو ليه شرح خاص. */
export function workStageHint(line: WorkLine, stage: WorkStage): string {
  if (line === 'studio' && stage === 'fulfilment') {
    return 'مسؤولو الإنتاج: بيستلموا المشروع في الفحص والتسليم والإيقاف، وأي مرحلة مالهاش محرر/مشرف فني معيّن، وتحذير إلغاء الطلب. في مراحل النص والرسم المهمة بتروح تلقائيًا للمحرر/المشرف الفني المعيّن على المشروع. لو فاضية: حاملو دور «مسؤول إنتاج القصص».';
  }
  return WORK_STAGE_HINTS[stage];
}
