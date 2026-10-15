/**
 * أنواع الإشعارات.
 *
 * كل إشعار في المنصة بقى ليه «نوع» — مفتاح قصير بيتبعت مع الإشعار.
 * من غيره، شاشة «أنواع الإشعارات» ما كانتش هتعرف توقف نوع معيّن، لأن كل
 * اللي كان موجود هو عنوان نصي بيتكتب في مكان الإرسال.
 *
 * إيقاف نوع معناه إن الإشعار **ما بيتبعتش أصلًا** — مش إنه بيتبعت
 * ويتخفي. ده مقصود: إشعار متبعت ومخفي بيفضل في القاعدة ويلخبط السجل.
 *
 * الحالة متخزّنة في `site_settings` تحت مفتاح `notifications`، فمفيش
 * جدول ولا عمود جديد.
 */
export type NotificationEvent =
  | 'payment_review'
  | 'order_status'
  | 'service_order_new'
  | 'service_message'
  | 'due_date'
  | 'session_update'
  | 'instructor_profile'
  | 'join_request'
  | 'support'
  | 'account_deletion'
  | 'withdrawal'
  | 'aqlam'
  | 'broadcast';

export const NOTIFICATION_EVENTS: {
  key: NotificationEvent;
  label: string;
  description: string;
  /** بيروح لمين. */
  audience: 'الإدارة' | 'العميل' | 'المدرب' | 'الطرفين';
  /** أنواع ما ينفعش تتقفل — إيقافها معناه إن الإدارة مش هتعرف بالفلوس. */
  locked?: boolean;
}[] = [
  {
    key: 'payment_review',
    label: 'إثبات دفع بانتظار المراجعة',
    description: 'عميل رفع إيصال — الطلب واقف لحد ما تراجعه.',
    audience: 'الإدارة',
    locked: true,
  },
  {
    key: 'order_status',
    label: 'تحديث حالة الطلب',
    description: 'تأكيد، بدء تنفيذ، تسليم، اكتمال، إلغاء أو استرجاع.',
    audience: 'العميل',
  },
  {
    key: 'service_order_new',
    label: 'طلب خدمة جديد',
    description: 'طلب وصل لمقدّم الخدمة أو بقى جاهز للتنفيذ.',
    audience: 'المدرب',
  },
  {
    key: 'service_message',
    label: 'رسالة على طلب خدمة',
    description: 'رسالة جديدة في محادثة الطلب.',
    audience: 'الطرفين',
  },
  {
    key: 'due_date',
    label: 'مهلة التسليم',
    description: 'تعديل أو اقتراب موعد التسليم.',
    audience: 'الطرفين',
  },
  {
    key: 'session_update',
    label: 'مواعيد وروابط الجلسات',
    description: 'تعديل موعد جلسة أو تحديث رابطها.',
    audience: 'الطرفين',
  },
  {
    key: 'instructor_profile',
    label: 'ملفات وخدمات المدربين',
    description: 'طلب تعديل ملف، واعتماده أو رفضه، واعتماد الخدمات.',
    audience: 'الطرفين',
  },
  {
    key: 'join_request',
    label: 'طلبات الانضمام',
    description: 'طلب انضمام جديد كمدرب أو ناشر.',
    audience: 'الإدارة',
  },
  {
    key: 'support',
    label: 'الدعم',
    description: 'تذكرة دعم جديدة أو طلب جلسة دعم.',
    audience: 'الإدارة',
  },
  {
    key: 'account_deletion',
    label: 'طلبات حذف الحسابات',
    description: 'عميل طلب حذف حسابه.',
    audience: 'الإدارة',
    locked: true,
  },
  {
    key: 'withdrawal',
    label: 'طلبات السحب',
    description: 'تحديث حالة طلب سحب أرباح.',
    audience: 'المدرب',
  },
  {
    key: 'aqlam',
    label: 'أقلام الرحلة',
    description: 'نص بانتظار موافقة ولي الأمر أو مراجعة الإدارة، ونتيجة المراجعة، وإخفاء تلقائي بعد بلاغات.',
    audience: 'الطرفين',
  },
  {
    key: 'broadcast',
    label: 'الإشعارات المرسلة من الإدارة',
    description: 'اللي بتبعته بنفسك من شاشة إرسال إشعار.',
    audience: 'الطرفين',
    locked: true,
  },
];

export const NOTIFICATION_EVENT_LABELS: Record<string, string> =
  Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.key, e.label]));
