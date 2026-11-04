/**
 * خريطة بيانات الموقع — طلب تامر (٢٧ أكتوبر): «تبويب خاص في لوحة التحكم
 * يساعدنا في الرؤية والفهم».
 *
 * الخريطة نفسها (الصناديق والمسارات) ثابتة هنا، لأنها وصف لبنية الكود.
 * ⚠️ لو اتضاف مسار جديد مهم (خدمة برّه، مهمة يومية، جدول رئيسي) — يتضاف هنا.
 * أما **لون نقاط التكدّس** فبيتحسب من أرقام حيّة (`ops_health` في القاعدة).
 */

export type NodeGroup = 'people' | 'vercel' | 'supa' | 'ext';

export type MapNode = { id: string; col: 0 | 1 | 2 | 3; y: number; group: NodeGroup; title: string; sub: string };

export const MAP_COLUMNS = [
  { x: 935, label: 'الناس', sub: '' },
  { x: 690, label: 'Vercel', sub: 'الموقع (Next.js)' },
  { x: 410, label: 'Supabase', sub: 'القاعدة والدخول' },
  { x: 135, label: 'خدمات برّه', sub: '' },
] as const;

export const MAP_NODES: MapNode[] = [
  { id: 'visitor', col: 0, y: 90, group: 'people', title: 'زائر', sub: 'بيتصفّح ويطلب' },
  { id: 'customer', col: 0, y: 170, group: 'people', title: 'ولي أمر / عميل', sub: 'حساب عميل' },
  { id: 'instructor', col: 0, y: 250, group: 'people', title: 'مدرب', sub: 'لوحة المدرب' },
  { id: 'admin', col: 0, y: 330, group: 'people', title: 'الإدارة والاستوديو', sub: 'لوحة التحكم' },
  { id: 'applicant', col: 0, y: 410, group: 'people', title: 'متقدّم للانضمام', sub: 'من غير حساب' },

  { id: 'pub', col: 1, y: 90, group: 'vercel', title: 'الصفحات العامة', sub: 'كاش ساعة' },
  { id: 'proxy', col: 1, y: 180, group: 'vercel', title: 'حارس الدخول', sub: 'proxy.ts — getClaims' },
  { id: 'dash', col: 1, y: 260, group: 'vercel', title: 'اللوحات والحساب', sub: 'بتتبني كل فتحة' },
  { id: 'actions', col: 1, y: 345, group: 'vercel', title: 'العمليات', sub: 'Server Actions' },
  { id: 'webhook', col: 1, y: 430, group: 'vercel', title: 'ويبهوك الدفع', sub: '/api/webhooks/xpay' },
  { id: 'crons', col: 1, y: 515, group: 'vercel', title: 'المهام اليومية', sub: '9 مهام (2:45–7:00 ص)' },

  { id: 'auth', col: 2, y: 70, group: 'supa', title: 'تسجيل الدخول', sub: 'Supabase Auth' },
  { id: 'rest', col: 2, y: 150, group: 'supa', title: 'واجهة القاعدة', sub: 'PostgREST + الصلاحيات' },
  { id: 'rpc', col: 2, y: 230, group: 'supa', title: 'الدوال والمحفّزات', sub: 'منطق الطلب والدفع' },
  { id: 'tCatalog', col: 2, y: 310, group: 'supa', title: 'المنتجات والمحتوى', sub: 'منتجات · باقات · إعدادات' },
  { id: 'tOrders', col: 2, y: 375, group: 'supa', title: 'الطلبات والدفع', sub: 'orders · payment_events' },
  { id: 'tSessions', col: 2, y: 440, group: 'supa', title: 'الجلسات والحجوزات', sub: 'sessions · subscriptions' },
  { id: 'tStudio', col: 2, y: 505, group: 'supa', title: 'الاستوديو ومهام الشغل', sub: 'story_projects · work_tasks' },
  { id: 'tPeople', col: 2, y: 570, group: 'supa', title: 'الناس والتأهيل', sub: 'مدربين · انضمام · تأهيل' },
  { id: 'tLogs', col: 2, y: 635, group: 'supa', title: 'الإشعارات والتدقيق', sub: 'notifications · audit_logs' },

  { id: 'xpay', col: 3, y: 150, group: 'ext', title: 'بوابة XPay', sub: 'كارت · محافظ' },
  { id: 'cloud', col: 3, y: 260, group: 'ext', title: 'Cloudinary', sub: 'كل الصور' },
  { id: 'resend', col: 3, y: 370, group: 'ext', title: 'Resend', sub: 'الإيميلات' },
  { id: 'wa', col: 3, y: 470, group: 'ext', title: 'واتساب', sub: 'يدوي من الإدارة' },
];

export type MapFlow = { id: string; name: string; steps: [string, string, string][] };

export const MAP_FLOWS: MapFlow[] = [
  { id: 'browse', name: 'زائر بيتصفّح', steps: [
    ['visitor', 'pub', 'بيفتح صفحة عامة'],
    ['pub', 'rest', 'لو الكاش خلص: قراءة من غير كوكيز'],
    ['rest', 'tCatalog', 'منتجات، محتوى، إعدادات'],
    ['pub', 'cloud', 'الصور من Cloudinary مباشرة'],
  ] },
  { id: 'order', name: 'طلب «إنها لك» والدفع', steps: [
    ['customer', 'pub', 'صفحة المنتج والتخصيص'],
    ['pub', 'actions', '«ادفع» → placeOrder'],
    ['actions', 'rpc', 'create_customer_order'],
    ['rpc', 'tOrders', 'الطلب والبنود'],
    ['actions', 'xpay', 'جلسة دفع وتحويل للبوابة'],
    ['xpay', 'webhook', 'البوابة بتبلّغ بالنتيجة'],
    ['webhook', 'rpc', 'record_gateway_payment'],
    ['rpc', 'tStudio', 'مشروع قصة + مهمة شغل (توزيع تلقائي)'],
    ['rpc', 'tLogs', 'إشعارات للإدارة'],
  ] },
  { id: 'booking', name: 'حجز جلسات الكتابة', steps: [
    ['customer', 'pub', 'المدربين والباقات'],
    ['pub', 'actions', 'تأكيد الحجز'],
    ['actions', 'rpc', 'create_course_booking'],
    ['rpc', 'tSessions', 'الاشتراك والجلسات'],
    ['crons', 'tSessions', 'تذكير الجلسات (5 ص)'],
    ['crons', 'tLogs', 'إشعارات التذكير'],
  ] },
  { id: 'studio', name: 'الاستوديو وصورة البطل', steps: [
    ['admin', 'proxy', 'دخول اللوحة'],
    ['proxy', 'dash', 'شاشة المشروع'],
    ['dash', 'rest', 'المشروع والنسخ والصفحات'],
    ['rest', 'tStudio', ''],
    ['dash', 'actions', '«ابعت الصورة للعميل»'],
    ['actions', 'rpc', 'story_image_send'],
    ['rpc', 'tLogs', 'إشعار لولي الأمر'],
    ['customer', 'dash', 'يوافق أو يطلب تعديل'],
  ] },
  { id: 'dash', name: 'أي فتحة لوحة', steps: [
    ['customer', 'proxy', 'أي صفحة في /dashboard أو /account'],
    ['proxy', 'auth', 'getClaims (محلي لو أمكن)'],
    ['proxy', 'dash', ''],
    ['dash', 'auth', 'getUser مرة واحدة للطلب'],
    ['dash', 'rest', 'الدور + الإعدادات + المحتوى + الإشعارات'],
    ['rest', 'tLogs', 'عدّاد الإشعارات'],
    ['rest', 'tCatalog', 'site_settings / page_content'],
  ] },
  { id: 'join', name: 'طلب انضمام', steps: [
    ['applicant', 'pub', 'نموذج الانضمام (واتساب إلزامي)'],
    ['pub', 'actions', 'submitJoinRequest'],
    ['actions', 'tPeople', 'join_requests'],
    ['admin', 'actions', 'رسالة للمتقدّم'],
    ['actions', 'resend', 'إيميل تلقائي بالرابط'],
    ['admin', 'wa', 'زرار «ابعت على واتساب»'],
    ['applicant', 'pub', 'يفتح الرابط ويرد'],
  ] },
  { id: 'training', name: 'التأهيل التأسيسي', steps: [
    ['instructor', 'proxy', ''],
    ['proxy', 'dash', 'تبويب التأهيل'],
    ['dash', 'rpc', 'المحتوى من غير الإجابات'],
    ['dash', 'actions', 'تصحيح الوحدة / التقييم'],
    ['actions', 'rpc', 'training_submit_*'],
    ['rpc', 'tPeople', 'التقدّم والمحاولات'],
    ['actions', 'tLogs', 'إشعار للإدارة لما ينجح'],
  ] },
  { id: 'nightly', name: 'المهام الليلية', steps: [
    ['crons', 'tOrders', 'إلغاء الطلبات المتروكة'],
    ['crons', 'cloud', 'مسح الصور المتسابة (حتى 10 آلاف)'],
    ['crons', 'tStudio', 'مواعيد مهام الشغل'],
    ['crons', 'resend', 'ملخّص الصبح بالمتأخر'],
    ['crons', 'tLogs', 'حفظ: مسح المقروء القديم وأرشفة السجل'],
  ] },
];

// ══ فاحص التكدّس الحي ════════════════════════════════════════
//
// ⚠️ قرار تامر (٢٧ أكتوبر): «اللي اتصلح مايفضلش ظاهر — الأداة نشغّلها بعد
//    فترة وتطلّع نقاط التكدّس والإصلاحات الممكنة». فمفيش قايمة ثابتة: كل
//    قاعدة تحت بتبص على الأرقام الحيّة (`ops_health`)، ولو لقت مشكلة بترجّع
//    «نقطة» فيها الدليل والإصلاح. لو مفيش مشكلة، مفيش نقطة.
//
//    إضافة فحص جديد = قاعدة جديدة في `RULES`.

export type Severity = 'high' | 'mid' | 'low';

export type Finding = {
  id: string;
  sev: Severity;
  /** الصناديق اللي بتتعلّم على الخريطة. */
  on: string[];
  title: string;
  /** الأرقام اللي خلّت الفحص يطلّعها. */
  evidence: string;
  fix: string;
  /** رابط الشاشة اللي فيها الإصلاح. */
  href?: string;
  hrefLabel?: string;
};

export type OpsHealth = {
  at: string;
  db_size_mb: number;
  connections: number;
  max_connections: number;
  tables: number;
  functions: number;
  triggers: number;
  policies: number;
  tasks: { line: string; open: number; overdue: number; unassigned: number; oldest_due: string | null }[];
  studio: { open: number; no_owner: number; rules: number; role_members: number };
  rules_by_line: Record<string, number>;
  rows: Record<string, number>;
  checks: { audit_index: boolean; retention: boolean; autoassign: boolean; batch_reviews: boolean };
  slow: { mean_ms: number; calls: number; q: string }[];
  hot: { calls: number; total_ms: number; q: string }[];
  /** من ترحيل 20261027130000 — ممكن تغيب قبله. */
  seq_heavy?: { t: string; rows: number; seq_scan: number; idx_scan: number }[];
  queues?: {
    cancel_days: number;
    orders_pending_stale: number;
    join_requests_old: number;
    tickets_old: number;
    image_reviews_old: number;
  };
  payments?: { failed_7d: number; paid_7d: number };
};

export const LINE_LABELS: Record<string, string> = {
  studio: 'الاستوديو',
  enha_lak: 'إنها لك',
  box: 'صندوق الرحلة',
  services: 'الخدمات',
  courses: 'الكورسات',
};

/** حدود الفحص — هنا عشان تتغيّر من مكان واحد. */
export const LIMITS = {
  slowMs: 150,
  slowMinCalls: 20,
  connectionsShare: 0.7,
  dbSizeMb: 4000,
  notificationsRows: 50_000,
  auditRows: 200_000,
  failedPaymentsShare: 0.2,
};

const ar = (n: number) => n.toLocaleString('ar-EG');
const A = '/dashboard/admin';

type Rule = (h: OpsHealth) => Finding | Finding[] | null;

const RULES: Rule[] = [
  // ── الشغل ─────────────────────────────────────────────────
  (h) =>
    h.tasks
      .filter((t) => t.unassigned > 0)
      .map((t) => ({
        id: `unassigned-${t.line}`,
        sev: 'high' as const,
        on: [t.line === 'studio' ? 'tStudio' : t.line === 'box' || t.line === 'enha_lak' ? 'tOrders' : 'tSessions', 'admin'],
        title: `مهام «${LINE_LABELS[t.line] ?? t.line}» من غير مسؤول`,
        evidence: `${ar(t.unassigned)} مهمة مفتوحة مالهاش حد.`,
        fix: 'حدّد مسؤولين للخط في «توزيع المهام»، أو اسند المهام دي بإيدك.',
        href: `${A}/tasks/assignments`,
        hrefLabel: 'توزيع المهام',
      })),
  (h) => {
    const late = h.tasks.filter((t) => t.overdue > 0);
    if (late.length === 0) return null;
    const total = late.reduce((s, t) => s + t.overdue, 0);
    const oldest = late
      .map((t) => (t.oldest_due ? Date.parse(t.oldest_due) : NaN))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    const days = oldest ? Math.floor((Date.now() - oldest) / 86_400_000) : 0;
    return {
      id: 'overdue',
      sev: days >= 3 ? 'high' : 'mid',
      on: ['tStudio', 'admin'],
      title: 'مهام عدّت ميعادها',
      evidence: `${ar(total)} مهمة متأخرة${days ? `، أقدمها من ${ar(days)} يوم` : ''} — ${late
        .map((t) => `${LINE_LABELS[t.line] ?? t.line}: ${ar(t.overdue)}`)
        .join('، ')}.`,
      fix: 'افتح «المهام» واقفل اللي خلص فعلًا، وحرّك أو أعد إسناد الباقي. لو المتأخر متكرّر في خط واحد، المدة المحدّدة للمرحلة دي أقصر من الواقع — عدّلها من «مراحل الشغل».',
      href: `${A}/tasks`,
      hrefLabel: 'المهام',
    };
  },
  (h) =>
    h.studio.no_owner > 0 && h.studio.rules === 0
      ? {
          id: 'studio-pool',
          sev: 'mid',
          on: ['tStudio'],
          title: 'الاستوديو مالوش محرّرين متحدّدين',
          evidence: `${ar(h.studio.no_owner)} مشروع قصة من غير محرّر/مشرف فني، و«توزيع المهام» مافيهوش حد للاستوديو.`,
          fix: 'اربط المحرّرين بدور «محرر قصص» والرسامين بـ«مشرف فني»، وحدّدهم لمراحل الاستوديو في «توزيع المهام» — المشاريع الجديدة هتتوزّع عليهم تلقائي بالأقل شغلًا.',
          href: `${A}/tasks/assignments`,
          hrefLabel: 'توزيع المهام',
        }
      : null,

  // ── طوابير بتستنى بشر ──────────────────────────────────────
  (h) =>
    h.queues && h.queues.join_requests_old > 0
      ? {
          id: 'join-requests',
          sev: 'mid',
          on: ['tPeople', 'applicant'],
          title: 'طلبات انضمام مستنية رد',
          evidence: `${ar(h.queues.join_requests_old)} طلب عدّى عليه أكتر من ٣ أيام من غير قرار.`,
          fix: 'رد عليهم من صفحة الطلب (الرسالة بتوصلهم إيميل، وفيه زرار واتساب) أو اقبل/ارفض.',
          href: `${A}/join-requests`,
          hrefLabel: 'طلبات الانضمام',
        }
      : null,
  (h) =>
    h.queues && h.queues.tickets_old > 0
      ? {
          id: 'tickets',
          sev: 'mid',
          on: ['admin', 'customer'],
          title: 'تذاكر دعم من غير رد',
          evidence: `${ar(h.queues.tickets_old)} تذكرة مفتوحة من أكتر من يومين.`,
          fix: 'رد على التذاكر — العميل اللي مستني رد هو أكتر واحد ممكن يلغي.',
          href: `${A}/support/tickets`,
          hrefLabel: 'رسائل الدعم',
        }
      : null,
  (h) =>
    h.queues && h.queues.image_reviews_old > 0
      ? {
          id: 'image-reviews',
          sev: 'low',
          on: ['customer', 'tStudio'],
          title: 'صور بطل مستنية موافقة العميل',
          evidence: `${ar(h.queues.image_reviews_old)} صورة اتبعتت من أكتر من ٣ أيام ومحدش رد.`,
          fix: 'كلّم ولي الأمر على الواتساب يفتح «طلباتي» ويوافق — كل يوم انتظار بيأخّر ميعاد التسليم.',
          href: `${A}/studio`,
          hrefLabel: 'الاستوديو',
        }
      : null,
  (h) =>
    h.queues && h.queues.orders_pending_stale > 0
      ? {
          id: 'stale-orders',
          sev: 'mid',
          on: ['crons', 'tOrders'],
          title: 'طلبات معلّقة عدّت مدة الإلغاء',
          evidence: `${ar(h.queues.orders_pending_stale)} طلب مستني دفع من أكتر من ${ar(h.queues.cancel_days + 1)} يوم — المهمة الليلية المفروض كانت لغتهم.`,
          fix: 'غالبًا المهمة اليومية «stale-orders» مابتشتغلش: راجع CRON_SECRET على Vercel وسجل المهام هناك.',
        }
      : null,

  // ── الدفع ─────────────────────────────────────────────────
  (h) => {
    const p = h.payments;
    if (!p) return null;
    const total = p.failed_7d + p.paid_7d;
    if (p.failed_7d < 3 || p.failed_7d / Math.max(total, 1) < LIMITS.failedPaymentsShare) return null;
    return {
      id: 'payments',
      sev: 'high',
      on: ['xpay', 'webhook'],
      title: 'محاولات دفع بتفشل',
      evidence: `${ar(p.failed_7d)} محاولة فشلت من ${ar(total)} آخر ٧ أيام.`,
      fix: 'راجع إعدادات بوابة XPay ومفاتيحها على Vercel، وسجل الدفع في صفحة الطلبات. لو البوابة واقفة، حوّل مؤقتًا للتحويل اليدوي من «التسعير والمدفوعات».',
      href: `${A}/settings/pricing`,
      hrefLabel: 'التسعير والمدفوعات',
    };
  },

  // ── القاعدة ───────────────────────────────────────────────
  (h) =>
    h.slow
      .filter((s) => s.mean_ms >= LIMITS.slowMs && s.calls >= LIMITS.slowMinCalls)
      .map((s) => ({
        id: `slow-${s.q}`,
        sev: s.mean_ms >= 500 ? ('high' as const) : ('mid' as const),
        on: ['rest', 'rpc'],
        title: `عملية بطيئة في القاعدة: ${s.q}`,
        evidence: `متوسط ${ar(s.mean_ms)} م.ث في ${ar(s.calls)} نداء.`,
        fix: /^[a-z_0-9]+$/.test(s.q)
          ? `لو «${s.q}» جدول: غالبًا ناقصه فهرس على العمود اللي بيترتّب أو بيتفلتر بيه، أو الشاشة بتجيب صفوف كتير مرة واحدة (محتاجة صفحات). لو دالة: محتاجة مراجعة استعلاماتها.`
          : 'محتاجة مراجعة الاستعلام ده والفهارس اللي بيستخدمها.',
      })),
  (h) =>
    (h.seq_heavy ?? []).map((t) => ({
      id: `seq-${t.t}`,
      sev: 'mid' as const,
      on: ['rest', 'tLogs'],
      title: `جدول كبير بيتقري بلف كامل: ${t.t}`,
      evidence: `${ar(t.rows)} صف — اتقري بلف كامل ${ar(t.seq_scan)} مرة مقابل ${ar(t.idx_scan)} بفهرس.`,
      fix: `محتاج فهرس على الأعمدة اللي الشاشات بتفلتر أو بترتّب بيها في «${t.t}».`,
    })),
  (h) =>
    h.connections >= h.max_connections * LIMITS.connectionsShare
      ? {
          id: 'connections',
          sev: 'high',
          on: ['rest'],
          title: 'الاتصالات بالقاعدة قربت من الحد',
          evidence: `${ar(h.connections)} من ${ar(h.max_connections)}.`,
          fix: 'راجع أي حاجة بتفتح اتصالات مباشرة (سكربتات، أدوات خارجية)، أو كبّر الباقة على Supabase.',
        }
      : null,
  (h) =>
    h.db_size_mb >= LIMITS.dbSizeMb
      ? {
          id: 'db-size',
          sev: 'mid',
          on: ['tLogs'],
          title: 'حجم القاعدة كبير',
          evidence: `${ar(h.db_size_mb)} ميجا.`,
          fix: 'راجع أكبر الجداول ومدد الحفظ، وحدود الباقة على Supabase.',
        }
      : null,
  (h) =>
    (h.rows.notifications_old_read ?? 0) > 1000 || (h.rows.notifications ?? 0) > LIMITS.notificationsRows
      ? {
          id: 'retention',
          sev: 'low',
          on: ['crons', 'tLogs'],
          title: 'الإشعارات القديمة مابتتمسحش',
          evidence: `${ar(h.rows.notifications ?? 0)} إشعار، منهم ${ar(h.rows.notifications_old_read ?? 0)} مقروء وأقدم من ٩٠ يوم.`,
          fix: 'المسح بيحصل في المهمة اليومية «task-deadlines» — راجع إنها شغّالة على Vercel.',
        }
      : null,
  (h) =>
    (h.rows.audit_logs ?? 0) > LIMITS.auditRows
      ? {
          id: 'audit-size',
          sev: 'low',
          on: ['tLogs'],
          title: 'سجل التدقيق كبير',
          evidence: `${ar(h.rows.audit_logs ?? 0)} سطر.`,
          fix: 'الأرشفة بتنقل اللي أقدم من سنة — لو الحجم كبير من غير ما يكون قديم، فيه عملية بتكتب في السجل أكتر من اللازم.',
        }
      : null,
  (h) =>
    !h.checks.audit_index || !h.checks.retention || !h.checks.autoassign || !h.checks.batch_reviews
      ? {
          id: 'missing-migrations',
          sev: 'high',
          on: ['rpc'],
          title: 'تحديثات قاعدة ناقصة',
          evidence: [
            !h.checks.audit_index && 'فهرس السجل',
            !h.checks.retention && 'الحفظ الليلي',
            !h.checks.autoassign && 'التوزيع التلقائي',
            !h.checks.batch_reviews && 'صور البطل المجمّعة',
          ]
            .filter(Boolean)
            .join('، '),
          fix: 'شغّل ترحيل 20261027100000_ops_assignment_and_retention في Supabase.',
        }
      : null,
];

const SEV_ORDER: Record<Severity, number> = { high: 0, mid: 1, low: 2 };

/** الفحص: بيرجّع المشاكل الحالية بس، مرتّبة بالخطورة. */
export function detectFindings(h: OpsHealth | null): Finding[] {
  if (!h) return [];
  const out: Finding[] = [];
  for (const rule of RULES) {
    try {
      const r = rule(h);
      if (Array.isArray(r)) out.push(...r);
      else if (r) out.push(r);
    } catch {
      /* قاعدة واحدة بايظة ماتوقفش الفحص */
    }
  }
  return out.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
}

export const SEV_LABELS: Record<Severity, string> = { high: 'عاجل', mid: 'مهم', low: 'متابعة' };

/** ألوان الشارة (Tailwind) — هنا مش في المكوّن، عشان صفحة الخادم تقراها. */
export const SEV_CHIP: Record<Severity, string> = {
  high: 'bg-rose-50 text-rose-800',
  mid: 'bg-amber-50 text-amber-900',
  low: 'bg-slate-100 text-slate-700',
};
export const SEV_FILL: Record<Severity, string> = { high: '#c2372b', mid: '#b26a00', low: '#64748b' };
