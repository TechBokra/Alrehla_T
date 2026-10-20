import type { SessionRecordingSettings } from '@/lib/session-recording';
import type { WatermarkSettings } from '@/lib/watermark-settings';
import type { MediaCleanupSettings } from '@/lib/media-cleanup';
import type { SiteImages } from '@/lib/site-images';
import type { AqlamSettings } from '@/lib/aqlam/settings';

// Import from auth if needed




export interface SiteSettings {
  siteName: string;
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  /** The wallet customers transfer to. Editable from the admin settings screen
   *  so it never has to be a number buried in the code again. */
  paymentWalletNumber: string;
  /** An InstaPay QR the customer can scan instead of typing the number. */
  paymentQrUrl: string;
  /** بيانات التواصل — بتظهر في الفوتر وصفحة التواصل. */
  contactPhone: string;
  /** رقم الواتساب بصيغة دولية بلا علامات: 201xxxxxxxxx */
  whatsappNumber: string;
  address: string;
  workingHours: string;
  /** شريط التنبيه العلوي. */
  announcement: {
    enabled: boolean;
    text: string;
    /** تاريخ ووقت الاختفاء التلقائي (ISO). فاضي = يفضل لحد ما توقفه. */
    until: string;
  };
  /**
   * حد تنبيه سعر المدرب.
   *
   * **تنبيه لا منع.** كان في الكود سقف ثابت (مليون) بيرفض الطلب —
   * ورقم السعر مالوش حد منطقي ثابت، وكل رقم بيتراجع يدويًا من الإدارة
   * أصلًا. دلوقتي الإدارة بتحدد الرقم من هنا، والمدرب فوقه يشوف تنبيه
   * ويقدر يكمل.
   *
   * صفر أو فاضي = مفيش تنبيه.
   */
  instructorPriceAlert: number;
  /**
   * طلب «بانتظار الدفع» من غير إيصال بيتلغي بعد كام يوم (قرار تامر: ٧،
   * وتتغيّر من الإعدادات). صفر = مابيتلغيش تلقائيًا.
   */
  pendingOrderCancelDays: number;
  /**
   * تسجيل الجلسات.
   *
   * ⚠️ **الإطفاء هنا بيوقّف التسجيل فعلًا، والنصّ اللي بيقول لولي
   *    الأمر إن الجلسة بتتسجّل بيختفي معاه.** الاتنين من نفس
   *    المفتاح عن قصد: شاشة بتقول «بتتسجّل» وتسجيل مقفول — أو
   *    العكس — أسوأ من الاتنين.
   *
   * و`retentionDays` مدة الاحتفاظ قبل الحذف التلقائي.
   */
  sessionRecording: SessionRecordingSettings;
  /** العلامة المائية على صور الموقع والمنتجات (`lib/watermark-settings`). */
  watermark: WatermarkSettings;
  /** المسح التلقائي للصور المتسابة (`lib/media-cleanup`). */
  mediaCleanup: MediaCleanupSettings;
  /**
   * ملفات طلبات الخدمات ومساحة الكتابة (ملف 20): بتتمسح من Cloudinary
   * بعد المدة دي من قفل الطلب أو مراجعة المستند (`lib/private-files`).
   */
  fileRetentionDays: number;
  /** مدة حفظ صور الأطفال في الطلبات المخصصة (من انتهاء الطلب). */
  childPhotoRetentionDays: number;
  /**
   * تشغيل «أقلام الرحلة» (`lib/aqlam/settings`). متخزّن جوّه نفس صف
   * `general` اللي كل صفحة بتقراه أصلًا، فالعلم مايكلّفش استعلامًا.
   * الافتراضي **مقفول**.
   */
  aqlam: AqlamSettings;
  /** Site imagery, by slot. See src/lib/site-images.ts. */
  images: SiteImages;
}
