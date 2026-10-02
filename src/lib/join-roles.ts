/**
 * الأدوار اللي الناس بتطلبها في نموذج الانضمام.
 *
 * ⚠️ **شاشة الطلب كانت بتكتب «طلب انضمام كناشر» لأي دور غير المدرب.**
 *    يعني الرسام والمعلّق الصوتي وكاتب القصص كلهم كانوا بيظهروا
 *    للإدارة كـ«ناشر» — وده مش تسمية وحشة وبس، ده بيوجّه الإدارة
 *    تحطّ الشخص في الدور الغلط. الناشر عندنا دور مستقل ليه شاشته
 *    وأرباحه؛ ودول **مقدّمو خدمة**.
 *
 * ⚠️ والقيم هنا لازم تفضل مطابقة للقيم في `src/app/join-us/JoinForm.tsx` —
 *    هي اللي بتتخزّن في `join_requests.requested_role`.
 */
export const JOIN_ROLE_LABELS: Record<string, string> = {
  instructor: 'مدرب',
  illustrator: 'رسام',
  voiceover: 'معلّق صوتي',
  author: 'كاتب قصص',
  other: 'دور آخر',
};

export function joinRequestRoleLabel(role: string | null | undefined): string {
  if (!role) return 'غير محدَّد';
  return JOIN_ROLE_LABELS[role] ?? role;
}

/** الأدوار اللي بتتحوّل لحساب مقدّم خدمة عند القبول. */
export const SERVICE_PROVIDER_ROLES = ['illustrator', 'voiceover', 'author'];
