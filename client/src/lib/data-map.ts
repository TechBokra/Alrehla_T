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

// ══ نقاط التكدّس ══════════════════════════════════════════════

export type HotState = 'open' | 'action' | 'fixed' | 'deferred';
export type Severity = 'high' | 'mid' | 'low';

export type Hotspot = {
  n: number;
  sev: Severity;
  on: string[];
  title: string;
  why: string;
  fix: string;
  state: HotState;
  /** سطر حيّ من الأرقام. */
  live: string;
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
};

export const LINE_LABELS: Record<string, string> = {
  studio: 'الاستوديو',
  enha_lak: 'إنها لك',
  box: 'صندوق الرحلة',
  services: 'الخدمات',
  courses: 'الكورسات',
};

const ar = (n: number) => n.toLocaleString('ar-EG');

/** حالة كل نقطة من الأرقام الحيّة. */
export function hotspotsFrom(h: OpsHealth | null): Hotspot[] {
  const overdue = h?.tasks.reduce((s, t) => s + t.overdue, 0) ?? 0;
  const unassigned = h?.tasks.reduce((s, t) => s + t.unassigned, 0) ?? 0;
  const oldest = h?.tasks
    .map((t) => (t.oldest_due ? Date.parse(t.oldest_due) : NaN))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const oldestDays = oldest ? Math.floor((Date.now() - oldest) / 86_400_000) : 0;
  const studioPool = (h?.studio.rules ?? 0) > 0;

  return [
    {
      n: 1, sev: 'high', on: ['tStudio', 'admin'],
      title: 'طابور الشغل: المتأخر والمسؤولين',
      why: 'كل طلب «أنت البطل» بيعمل مشروع ومهمة. لو مفيش مسؤول أو محدش بيفتح المهام، الطلب بيقف والعميل مستني.',
      fix: 'اتصلح التوزيع (المهام بتروح لمسؤولي الخط، وتوزيع تلقائي بالأقل شغلًا) + ملخّص بالإيميل كل صباح. فاضل: تحديد المحرّرين والمشرفين الفنيين لكل مرحلة في «توزيع المهام».',
      state: !h ? 'open' : unassigned > 0 ? 'open' : !studioPool || overdue > 0 ? 'action' : 'fixed',
      live: !h
        ? 'الأرقام مش متاحة.'
        : `${ar(overdue)} مهمة متأخرة${oldestDays ? ` (أقدمها ${ar(oldestDays)} يوم)` : ''} · ${ar(unassigned)} من غير مسؤول · ${ar(h.studio.no_owner)} مشروع قصة من غير محرّر/مشرف · ناس الاستوديو في «توزيع المهام»: ${ar(h.studio.rules)}`,
    },
    {
      n: 2, sev: 'mid', on: ['actions', 'pub'],
      title: 'أي حفظ في اللوحة بيمسح كاش الموقع كله',
      why: 'refreshPublicPages بيحدّث كل الصفحات العامة مع أي تعديل. مع زيارات كتير، أول الزوار بعد كل تعديل بيبنوا الصفحات من جديد.',
      fix: 'تحديث بالعلامات (منتجات/مدربين/محتوى/إعدادات) — مؤجّل لقبل أول حملة إعلانات.',
      state: 'deferred',
      live: 'مؤجّل بقرار — الزيارات الحالية صغيرة.',
    },
    {
      n: 3, sev: 'mid', on: ['proxy', 'auth', 'dash'],
      title: 'رحلات الدخول مع كل فتحة لوحة',
      why: 'الحارس والصفحة كانوا بيسألوا خادم الدخول، وبيانات المستخدم كانت بتتقري كذا مرة في نفس الصفحة.',
      fix: 'getClaims في الحارس، وgetCurrentUser مرة واحدة لكل طلب.',
      state: 'fixed',
      live: h?.hot?.length ? `أكتر استعلام متكرر: ${h.hot[0].q} (${ar(h.hot[0].calls)} مرة)` : 'اتصلح.',
    },
    {
      n: 4, sev: 'mid', on: ['tLogs'],
      title: 'سجل التدقيق',
      why: 'الشاشة كانت بتجيب 200 صف بترتيب التاريخ من غير فهرس.',
      fix: 'فهرس على التاريخ + صفحات + الرئيسية بتجيب 8 بس.',
      state: h?.checks.audit_index ? 'fixed' : 'open',
      live: h ? `${ar(h.rows.audit_logs ?? 0)} سطر في السجل` : '',
    },
    {
      n: 5, sev: 'mid', on: ['crons', 'cloud'],
      title: 'مسح الصور الليلي',
      why: 'كان بيقف في صمت فوق 500 صورة.',
      fix: 'لحد 10 آلاف صورة، 5 دقايق، وإشعار لو اتخطّى.',
      state: 'fixed',
      live: 'اتصلح في الكود.',
    },
    {
      n: 6, sev: 'low', on: ['tLogs'],
      title: 'جداول بتكبر للأبد',
      why: 'الإشعارات والسجلات مالهاش مدة حفظ.',
      fix: 'كل ليلة: مسح الإشعارات المقروءة الأقدم من 90 يوم، وأرشفة السجل الأقدم من سنة.',
      state: h?.checks.retention ? 'fixed' : 'open',
      live: h
        ? `${ar(h.rows.notifications ?? 0)} إشعار · ${ar(h.rows.notifications_old_read ?? 0)} مستني المسح الليلة الجاية`
        : '',
    },
    {
      n: 7, sev: 'low', on: ['dash'],
      title: '«طلباتي» نداء لكل طلب',
      why: 'صور البطل كانت بتتسأل لكل طلب لوحده.',
      fix: 'نداء واحد لكل الطلبات.',
      state: h?.checks.batch_reviews ? 'fixed' : 'open',
      live: '',
    },
    {
      n: 8, sev: 'low', on: ['actions', 'resend'],
      title: 'الإيميلات جوّه العملية نفسها',
      why: 'الزرار بيستنى Resend يرد. مشكلة بس مع الإرسال الجماعي.',
      fix: 'طابور إرسال — مؤجّل لحد ما يبقى فيه إرسال جماعي.',
      state: 'deferred',
      live: 'مؤجّل بقرار.',
    },
  ];
}

export const STATE_LABELS: Record<HotState, string> = {
  open: 'محتاج تصليح',
  action: 'محتاج خطوة منكم',
  fixed: 'اتصلح',
  deferred: 'مؤجّل',
};

/** ألوان شارة الحالة (Tailwind) — هنا مش في المكوّن، عشان صفحة الخادم تقراها. */
export const STATE_CHIP: Record<HotState, string> = {
  open: 'bg-rose-50 text-rose-800',
  action: 'bg-amber-50 text-amber-900',
  fixed: 'bg-emerald-50 text-emerald-800',
  deferred: 'bg-slate-100 text-slate-700',
};
