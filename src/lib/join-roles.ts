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

/**
 * الدور المطلوب في الطلب ← الشاشة اللي بتعمل الحساب فعلًا.
 *
 * ⚠️ **ليه مش بننشئ الحساب هنا على طول؟**
 *
 * طلب الانضمام فيه: اسم وبريد وتليفون ورسالة ورابط أعمال. وملف المدرب
 * محتاج كمان: اسم العرض، والتخصصات، وسنين الخبرة، ونموذج العمل. يعني
 * الإنشاء التلقائي هيطلّع **ملف مدرب نصّه فاضي** — وده بالظبط اللي
 * `admin-users.ts` بيمنعه لما شال «مدرب» من أدوار شاشة المستخدمين:
 * «دور من غير ملف = لوحة فاضية وحساب مكسور».
 *
 * فالقبول بيوصّل الإدارة لشاشة الإنشاء الصح **والخانات متملّية** بالـ
 * اللي في الطلب. الإدارة بتكمّل الباقي وتضغط. خطوة واحدة بدل إنها
 * تفتح شاشة تانية وتنسخ البيانات بإيدها.
 *
 * ⚠️ **والرسّام والمعلّق الصوتي والكاتب مش ناشرين.** شاشة الطلب كانت
 *    بتكتب «طلب انضمام كناشر» لأي دور غير المدرب — وده غلط بيخلّي
 *    الإدارة تحطّ الشخص في المكان الغلط. دول **مقدّمو خدمة**
 *    (`service_provider`)، والناشر دور تاني خالص.
 */
export function joinNextStep(
  requestedRole: string,
  applicantName: string,
  email: string,
  message: string | null,
): { nextHref?: string; nextLabel?: string } {
  const q = new URLSearchParams({ new: '1', email, name: applicantName });

  if (requestedRole === 'instructor') {
    if (message) q.set('bio', message.slice(0, 500));
    return {
      nextHref: `/dashboard/admin/instructors?${q.toString()}`,
      nextLabel: 'كمّل إنشاء ملف المدرب',
    };
  }

  if (SERVICE_PROVIDER_ROLES.includes(requestedRole)) {
    q.set('role', 'service_provider');
    return {
      nextHref: `/dashboard/admin/users?${q.toString()}`,
      nextLabel: 'كمّل إنشاء حساب مقدّم الخدمة',
    };
  }

  // `other` — مفيش شاشة واحدة صح. الإدارة تقرّر.
  return {};
}
