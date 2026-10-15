import type { UserRole } from '@/types';

/**
 * شاشة المستخدمين فيها **ناس مختلفة تمامًا** بتتعرض في جدول واحد.
 *
 * ── المشكلة ─────────────────────────────────────────────────
 *
 * «المستخدمون» كانت بتخلط مدير النظام والمدربين والناشرين مع العملاء
 * وأولياء الأمور وحسابات الأطفال في قايمة واحدة مرتّبة بالتسجيل. وده
 * بيخلّي أبسط سؤالين على الشاشة صعبين:
 *
 *   • «مين في فريقي؟» → بتدوّر في ميّة عميل.
 *   • «العميل اللي اتصل بيا فين؟» → بيطلع جنب حساب إداري بنفس الشكل.
 *
 * وأخطر من ده: تغيير الدور بيتعمل من الجدول مباشرة، والصفّين جنب بعض
 * بيبقى شكلهم واحد — فضغطة غلط بتدّي صلاحيات إدارية لعميل.
 *
 * ── الفصل ───────────────────────────────────────────────────
 *
 *   الفريق   = اللي **بيشغّل** المنصة (إدارة، مدربون، ناشرون، مقدّمو خدمة)
 *   العائلات = اللي **بيستعمل** المنصة (عملاء، أولياء أمور، حسابات أطفال)
 *
 * ⚠️ ولي الأمر مش دور مستقل: هو `customer` ومعاه `isGuardian` — فهو في
 *    جهة العائلات، وفلتر «ولي أمر» بيضيّق جوّاها.
 */

export const TEAM_ROLES: UserRole[] = [
  'super_admin',
  'general_supervisor',
  'instructor',
  'service_provider',
  'publisher',
];

export const FAMILY_ROLES: UserRole[] = ['customer', 'student', 'visitor'];

export type Audience = '' | 'team' | 'family';

export const AUDIENCE_LABELS: Record<Exclude<Audience, ''>, string> = {
  team: 'الفريق',
  family: 'العملاء والعائلات',
};

export function audienceOf(role: UserRole): Exclude<Audience, ''> {
  return TEAM_ROLES.includes(role) ? 'team' : 'family';
}

/** `''` = الكل. */
export function matchesAudience(role: UserRole, audience: Audience): boolean {
  return audience === '' || audienceOf(role) === audience;
}
