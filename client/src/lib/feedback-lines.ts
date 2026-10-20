/**
 * آراء العملاء بتتوجّه لخط من الاتنين (ملف 10 — ملاحظة تامر): ولي الأمر
 * بيكتب عن «إنها لك» لو اشترى منها، وعن «بداية الرحلة» لو اشترك فيها،
 * والاتنين لو استعملهم. والرأي بيوصل لقسمه في اللوحة.
 */
export type FeedbackLine = 'enha_lak' | 'creative_writing';

export const FEEDBACK_LINES: FeedbackLine[] = ['enha_lak', 'creative_writing'];

export const FEEDBACK_LINE_LABELS: Record<FeedbackLine, string> = {
  enha_lak: 'إنها لك',
  creative_writing: 'بداية الرحلة',
};

/** تبويب كل خط في اللوحة (`lib/admin-nav`). */
export const FEEDBACK_ADMIN_HREF: Record<FeedbackLine, string> = {
  enha_lak: '/dashboard/admin/feedback/enha-lak',
  creative_writing: '/dashboard/admin/feedback/creative-writing',
};

export function isFeedbackLine(v: unknown): v is FeedbackLine {
  return v === 'enha_lak' || v === 'creative_writing';
}
