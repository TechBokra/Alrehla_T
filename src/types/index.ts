// الأدوار المتاحة للمستخدمين في المنصة
export type UserRole =
  'visitor' | 'customer' | 'student' | 'instructor' | 'service_provider' | 'publisher' | 'general_supervisor' | 'super_admin';

// الملف الشخصي للمستخدم
export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isGuardian?: boolean;
  avatarUrl?: string;
  createdAt: string;
  permissions?: AdminPermission[];
  /**
   * الحساب لسه على الرمز المؤقت وما حطّش كلمة مروره.
   * مصدرها `app_metadata` بتاع Supabase — انظر `src/lib/first-login.ts`.
   */
  mustSetPassword?: boolean;
  /**
   * موقوف عن **الشراء الجديد** من التاريخ ده — SQL 118.
   *
   * ⚠️ **الدخول مابيتمنعش.** منع الدخول بيقفل على الأهل الجلسات
   *    اللي دفعوا تمنها ومعرض شغل ابنهم — عقاب على خلاف إداري
   *    بيطول خدمة مدفوعة.
   */
  suspendedAt?: string | null;
  suspensionReason?: string | null;
};

// الفئة العمرية للباقات
export type AgeGroup = 'under_12' | '12_plus';

// باقة الكتابة الإبداعية
/** مسار الباقة — مستقل عن الفئة العمرية: مسارين ممكن يكونوا لنفس السن. */
export type PackageTrack = 'foundation' | 'youth' | 'specialization';

export type WritingPackage = {
  id: string;
  slug: string;
  name: string;
  ageGroup: AgeGroup;
  track?: PackageTrack | null;
  price: number;
  durationText: string;
  sessionsCount: number;
  sessionDuration?: string;
  targetAudience: string;
  prerequisiteNote?: string;
  prerequisitePackageId?: string;
  shortDescription: string;
  fullDescription: string;
  isActive: boolean;
};

// ملف المدرب

export type DayOfWeek = 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export type WeeklySlot = {
  day: DayOfWeek;
  time: string; // HH:mm format, e.g., "10:00"
  isBooked?: boolean;
  commitmentType?: 'ongoing' | 'fixed_term';
  commitmentMonths?: number;
  commitmentEndsAt?: string;
};

/**
 * ميعاد محجوز فعلًا، محسوب من جلسات المدرب القادمة.
 *
 * `isBooked` اللي على `WeeklySlot` **مفيش حاجة في المشروع بتكتبه** — ولا
 * سطر واحد. فالميعاد اللي اتحجز كان بيفضل معروض لعميل تاني إلى الأبد،
 * وعميلين يقدروا يحجزوا نفس المدرب في نفس الساعة من نفس اليوم.
 *
 * دلوقتي الإتاحة بتتحسب من الواقع: أي جلسة قادمة للمدرب بتشغّل ميعادها
 * لحد آخر جلسة في نفس الاشتراك. فباقة شهرين بتقفل ميعادها شهرين.
 */
export type BookedSlot = {
  day: DayOfWeek;
  time: string;
  /** آخر جلسة في الميعاد ده (ISO). بعده الميعاد بيفضى. */
  bookedUntil: string;
};

export type WorkModel = 'per_session' | 'monthly';

export type InstructorStatus = 'pending_training' | 'pending_approval' | 'active' | 'suspended';

export type Instructor = {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  specialties: string[];
  avatarUrl?: string;
  yearsExperience: number;
  isSample?: boolean;
  status: InstructorStatus;
  
  // New Fields for Scheduling & Pricing
  trainingPassed: boolean;
  workModel: WorkModel;
  requestedPrice?: number;
  selectedPricingOptionId?: string;
  approvedPrice?: number; // Price approved by admin
  
  weeklySchedule: WeeklySlot[]; // The standard weekly schedule they offer
  pendingSchedule?: WeeklySlot[]; // If they requested a schedule change
  
  monthlyHoursCommitted?: number; // Only if workModel === 'monthly'. Minimum 60.

  /**
   * الباقات اللي المدرب بيدرّبها (ملف SQL 102).
   *
   * ⚠️ **المصفوفة الفاضية معناها «كل الباقات» — مش «ولا باقة».**
   *
   *    والفرق ده مقصود: لو الفاضي معناه «ولا باقة»، كان كل المدربين
   *    يختفوا من الموقع أول ما الميزة تنشر، لحد ما الإدارة تفتح كل
   *    واحد وتحدّدله. الافتراضي لازم يبقى الوضع اللي كان شغّالًا.
   */
  packageIds?: string[];
};

/**
 * المدرب كما تراه الصفحات العامة.
 *
 * ── ليه نوع منفصل ───────────────────────────────────────────
 *
 * صفحات المدربين العامة كانت بتقرا `select('*')` بمفتاح الزائر، فكل
 * أعمدة الجدول كانت بتوصل للمتصفح: `approved_price` و`requested_price`
 * و`monthly_hours_committed` و`work_model`. يعني **السعر المتفاوَض عليه
 * مع كل مدرب وشروط تعاقده** كانت مكتوبة في صفحة عامة، يقراها أي زائر —
 * ومنهم مدرب تاني أو منافس.
 *
 * النوع ده بيشيل الأعمدة دي من المسار العام أصلًا، فالتسريب بيتقفل عند
 * الاستعلام مش عند العرض: البيانات **ما بتخرجش من القاعدة** من الأساس.
 *
 * ⚠️ `weeklySchedule` باقٍ عن قصد — العميل لازم يشوف المواعيد المتاحة
 *    عشان يحجز. مواعيد مش أسعارًا.
 */
export type PublicInstructor = Omit<
  Instructor,
  | 'trainingPassed'
  | 'workModel'
  | 'requestedPrice'
  | 'selectedPricingOptionId'
  | 'approvedPrice'
  | 'pendingSchedule'
  | 'monthlyHoursCommitted'
>;

export interface ProfileUpdateRequest {
  id: string;
  instructorId: string;
  requestedChanges: Partial<Instructor>;
  status: 'pending' | 'approved' | 'rejected';
  adminFeedback?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  studentId: string;
  studentName: string;
  instructorId: string;
  rating: number; // 1 to 5
  comment: string;
  scheduledSessionId?: string;
  createdAt: string;
}


// خدمة إبداعية مستقلة
export type CreativeService = {
  id: string;
  name: string;
  price: number;
  description: string;
  /** Grouping shown on the public services page, e.g. 'مراجعات'. */
  category?: string;
  /** 'fixed' = one platform price. 'starts_from' = depends on the instructor. */
  priceType: 'fixed' | 'starts_from';
  sortOrder?: number;
  /** خدمة موقوفة تختفي من الموقع، وطلباتها القديمة تفضل زي ما هي. */
  isActive: boolean;
};

/** One instructor's offer to provide one creative service, at a price. */
export type InstructorServiceOffer = {
  id: string;
  instructorId: string;
  serviceId: string;
  requestedPrice?: number;
  approvedPrice?: number;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * مين يقدر يقدّم خدمة إبداعية.
 *
 * - platform   — المنصة نفسها. مفيش مستحق يتدفع لحد.
 * - instructor — مدرب مسجّل، وله صفحته العامة.
 * - individual — مقدّم خدمة مستقل مش مدرب. بيظهر في قايمة الاختيار بس.
 */
export type ProviderKind = 'platform' | 'instructor' | 'individual';

/** A provider row as shown to a visitor choosing who will do the work. */
export type ServiceProvider = {
  offerId: string;
  providerId: string;
  kind: ProviderKind;
  /** موجود للمدرب بس — الأنواع التانية ما لهاش صف في جدول المدربين. */
  instructorId: string | null;
  displayName: string;
  bio: string;
  yearsExperience: number;
  /**
   * صورة مقدّم الخدمة — من `user_profiles.avatar_url` عبر صف المدرب.
   *
   * ⚠️ فاضية للأنواع اللي مالهاش صف في جدول المدربين (شريك، ناشر).
   */
  avatarUrl?: string;
  /**
   * اللي العميل بيدفعه فعلًا.
   *
   * ⚠️ كان فيه فرق بين ده وبين اللي بيتعرض: الصفحة كانت بتعرض مستحق
   * المدرب، والخادم بيحسب فوقه معادلة المنصة — فالعميل يشوف رقمًا
   * ويتحاسب برقم أكبر. الحقل ده بقى هو اللي بيتعرض وبيتحاسب.
   */
  price: number;
  /** مستحق مقدّم الخدمة. فاضي لما المنصة هي المقدّم — مفيش حد يتدفعله. */
  providerEarning: number | null;
};

/** صف مقدّم خدمة كما تراه الإدارة. */
export type ServiceProviderAccount = {
  id: string;
  kind: ProviderKind;
  userId: string | null;
  instructorId: string | null;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  status: 'pending' | 'active' | 'suspended';
  isPublic: boolean;
  createdAt: string;
};

// حالة الحجز
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/**
 * حالة الجلسة.
 *
 * ⚠️ **دي مش `BookingStatus`.** الجلسات كانت متعلَّمة `BookingStatus`،
 *    وهي **مفيهاش `scheduled`** — وهي **القيمة الافتراضية للعمود في
 *    القاعدة**. يعني النوع كان بيقول إن قيمة مستحيلة، وهي أشهر قيمة
 *    في الجدول.
 *
 * والسبب إن `getSessions()` كانت بتكتب `sess.status as any`، فالـ
 * `as any` شال التحقّق اللي كان هيمسك الفرق ده من أول يوم. ودي نفس
 * فئة العطل بتاعة قاعدة «ج»: النوع بيقول حاجة والقاعدة فيها حاجة تانية.
 */
export type SessionStatus =
  | 'pending'
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

// عملية الحجز لباقة معينة
export type Booking = {
  id: string;
  sessionId: string;
  status: BookingStatus;
  bookedAt: string;
};

// فئة المنتج المخصص
export type ProductCategory = 'library' | 'custom' | 'subscription';

// منتج مخصص (قصة، هدية، الخ)
export type PersonalizedProduct = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  price: number;
  electronicPrice?: number;
  shortDescription: string;
  coverImageUrl?: string;
  publisherId?: string;
  ownerType: 'platform' | 'publisher';
  features?: string[];
  /** الوصف الكامل لصفحة المنتج — `shortDescription` سطر للكارت (ملف 130). */
  longDescription?: string;
  /** صور إضافية: صفحات من جوّه الكتاب، الغلاف الخلفي، عيّنة رسومات (ملف 130). */
  galleryImageUrls?: string[];
  /**
   * حالة مراجعة الإدارة — ملف 130.
   *
   * ⚠️ **منفصلة عن `isActive` عن قصد**: `isActive` قرار إداري
   *    بالإيقاف، ودي حالة في مسار المراجعة. المنتج بيظهر للعميل
   *    لما **الاتنين** يبقوا تمام.
   */
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  /**
   * نصيب الناشر من النسخة الواحدة (ملف SQL 97).
   *
   * ⚠️ **مش للعرض للعميل.** `price` هو سعر العميل، وده اللي بيوصل
   *    للناشر — بيظهر في شاشة الناشر وشاشة الإدارة وبس.
   */
  publisherCost?: number;
  /**
   * معروض للبيع — SQL 121.
   *
   * ⚠️ **الافتراضي `true` في القاعدة**، والموقوف بيتشال من الموقع
   *    **وبيترفض في الطلبات الجديدة بمحفّز**، وبنود الطلبات
   *    القديمة بتفضل زي ما هي.
   */
  isActive: boolean;
  /**
   * تاريخ الإضافة — **عشان ترتيب «الأحدث» يبقى صادق**.
   *
   * ⚠️ كان الترتيب بيتعمل بـ`id.localeCompare` لأن التاريخ مكانش
   *    بيتقرا أصلًا. ورقم المنتج `uuid` عشوائي، يعني «الأحدث» كانت
   *    بتدّي ترتيبًا **عشوائيًّا وثابتًا** — مش غلط باين، وده
   *    اللي خلّاه يعدّي.
   */
  createdAt?: string;
};

// حالة الطلب
export type OrderStatus =
  | 'pending'
  | 'awaiting_verification'
  | 'paid'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'refunded';

// طلب شراء من المتجر
export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  customizationData?: {
    recipientType?: 'self' | 'child';
    childId?: string;
    childName?: string;
    childPhotoUrl?: string;
    coverChoice?: string;
    notes?: string;
  };
}

// طلب شراء من المتجر
export type Order = {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  transactionReference?: string;
  /** رقم مرجعي بيتولّد في القاعدة مع الطلب — العميل بيكتبه في ملاحظة التحويل. */
  paymentReference?: string;
  paymentMethod?: 'instapay' | 'vodafone_cash';
  paymentReceiptUrl?: string;
  /** Fulfilment — the order used to stop at "paid" with nothing after it. */
  trackingReference?: string;
  shippedAt?: string;
  deliveredAt?: string;
  adminNotes?: string;
  shippingFee?: number;
  recipientName?: string;
  recipientPhone?: string;
  addressLine?: string;
  city?: string;
  governorate?: string;
  shippingNotes?: string;
};

// مقال في المدونة
export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  publishedAt: string;
  authorName: string;
};

// شهادة مستخدم
export type Testimonial = {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
};

// إضافة إضافية لمنتج
export type AddonProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  /**
   * هل الإضافة دي بتقبل تخصيص باسم الطفل وبياناته؟
   *
   * الإدارة هي اللي بتقرر. «كوباية باسم البطل» بتقبل، و«تغليف هدية» لأ.
   * لو `false` والمتصفح بعت طلب تخصيص ليها، دالة `create_customer_order`
   * **بترفض الطلب كله** — فالشاشة لازم تخفي الاختيار أصلًا.
   */
  supportsCustomization: boolean;
  /** الفرق اللي بيتضاف على السعر لو العميل اختار «بتخصيص». */
  customizationPrice: number;
};

// خطة اشتراك
export type SubscriptionTier = {
  id: string;
  name: string;
  priceTotal: number;
  priceMonthly: number;
  durationMonths: number;
  savingsNote?: string;
  /** صورة الباقة — تُرفع من لوحة الإدارة. */
  imageUrl?: string;
  description?: string;
  /** ما يميّز الباقة عن غيرها، سطر لكل ميزة. */
  features: string[];
  /** باقة واحدة فقط تحمل شارة «الأكثر اختيارًا» — مضمون بفهرس في قاعدة البيانات. */
  isHighlighted: boolean;
  isActive: boolean;
  sortOrder: number;
};

// أفراد العائلة المرتبطين بحساب
export interface FamilyMember {
  id: string;
  fullName: string;
  birthDate: string | null;
  avatarUrl?: string | null;
}

// الإشعارات
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  /** Where the notification points, when it points anywhere. */
  link?: string;
}

// تذاكر الدعم
export interface SupportTicket {
  id: string;
  senderName?: string;
  requesterName?: string;
  subject: string;
  category: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

// الناشر
export type Publisher = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  bio: string;
  isSample: boolean;
  status: 'pending' | 'active' | 'suspended';
};


// حالة الدفع
export type PayoutStatus = 'pending' | 'paid';

// مستحقات المدرب
export interface InstructorPayout {
  id: string;
  instructorId: string;
  period: string;
  amount: number;
  status: PayoutStatus;
}

// مستحقات الناشر
export interface PublisherPayout {
  id: string;
  publisherId: string;
  period: string;
  amount: number;
  status: PayoutStatus;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface SessionAttachment {
  id: string;
  sessionId: string;
  fileName: string;
  fileUrl: string;
}

export interface StudyMaterial {
  id: string;
  title: string;
  description: string;
  packageName: string;
}

/**
 * جلسة كما يراها المدرب — بلا أي بيانات دفع.
 *
 * بتيجي من دالة `instructor_sessions` في القاعدة، مش من join على
 * `course_subscriptions` (اللي المدرب ممنوع منه).
 */
export interface InstructorSession {
  id: string;
  sessionNumber: number;
  scheduledAt: string;
  status: SessionStatus;
  meetingUrl?: string;
  courseSubscriptionId: string;
  participantName: string;
  packageName: string;
  packageId: string;
  /** معرّف صاحب الحساب — هو اللي روابط ملف الطالب بتستخدمه. */
  studentRef: string;
  childId?: string;
}

/** جلسة كما يراها المتعلّم — بلا أي بيانات دفع. */
export interface StudentSession {
  id: string;
  sessionNumber: number;
  scheduledAt: string;
  status: SessionStatus;
  meetingUrl?: string;
  packageName: string;
  instructorName?: string;
}

export interface InstructorStudent {
  /** رقم المشتري — وهو اللي روابط الصفحات مبنية عليه. */
  id: string;
  /**
   * رقم صاحب مستندات المعرض.
   *
   * ⚠️ **غير `id`** لما الطالب طفل تابع عنده حساب دخول: المستندات
   *    بتتخزّن باسم حساب الطفل، و`id` رقم ولي الأمر اللي اشترى.
   *    السؤال بـ`id` بيرجّع صفر مستندات **بلا خطأ**.
   */
  documentsRef: string;
  name: string;
  avatarUrl?: string;
  packageName: string;
  sessionsCompleted: number;
  totalSessions: number;
}


export type AdminPermission = 
  | 'canManageUsers'
  | 'canManageInstructors'
  | 'canManagePublishers'
  | 'canManageCatalog'
  | 'canManageSubscriptions'
  | 'canManageOrders'
  | 'canManageBookings'
  | 'canManageSupport'
  | 'canManageContent'
  | 'canManageFinance'
  | 'canViewAuditLogs';


export type BoxSubscription = {
  id: string;
  customerName: string;
  planName: string;
  status: 'active' | 'cancelled' | 'paused';
  nextShipmentDate: string;
};

export type JoinRequest = {
  id: string;
  applicantName: string;
  requestedRole: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  /** Supplied by the applicant. The admin screen used to print invented
   *  contact details because none of this was stored. */
  email?: string;
  phone?: string;
  portfolioUrl?: string;
  message?: string;
};

export type SupportSessionRequest = {
  id: string;
  contactName: string;
  contactPhone: string;
  message: string;
  status: 'pending' | 'contacted' | 'closed';
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actorName?: string;
  actorProfileId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

// طلب خدمات بداية الرحلة
export type ServiceOrderStatus = 'pending' | 'awaiting_verification' | 'paid' | 'refunded';

export interface ServiceOrder {
  id: string;
  buyerProfileId: string;
  packageId?: string;
  serviceId?: string;
  status: ServiceOrderStatus;
  amount: number;
  createdAt: string;
  transactionReference?: string;
}

// اشتراك في دورة
export type CourseSubscriptionStatus = 'active' | 'completed' | 'cancelled';

export interface CourseSubscription {
  id: string;
  packageId: string;
  userId: string;
  participantType: 'self' | 'child';
  childId?: string;
  status: CourseSubscriptionStatus;
  startedAt: string;
  createdAt: string;
}


export type DocumentStatus = 'draft' | 'submitted' | 'reviewed';

export interface PortfolioDocument {
  id: string;
  studentId: string;
  title: string;
  content: string;
  status: DocumentStatus;
  instructorFeedback?: string;
  updatedAt: string;
}




export type PaymentMethod = 'credit_card' | 'fawry' | 'wallet';




export interface InstructorPricingOption {
  id: string;
  label: string;
  basePricePerSession: number;
  isActive: boolean;
}

export interface PricingFormulaSettings {
  id: string; // سجل واحد فقط (singleton) — استخدم id ثابت مثل 'default'
  platformMultiplier: number; // مثال: 1.2
  fixedAdminFee: number; // مثال: 50
  updatedAt: string;
}

export type BillingModel = 'monthly' | 'per_session';
export type CompensationApprovalStatus = 'proposed' | 'under_discussion' | 'approved' | 'rejected';

export interface InstructorCompensationProfile {
  id: string;
  instructorId: string;
  billingModel: BillingModel;
  selectedPricingOptionId: string;
  monthlyMinimumHours: number; // افتراضي 60، يُستخدم فقط عند billingModel = 'monthly'
  overtimeRatePerHour?: number;
  approvalStatus: CompensationApprovalStatus;
  adminNotes?: string;
  reviewedByProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorCertification {
  id: string;
  instructorId: string;
  trainingCompletedAt?: string;
  trainingMeetingLink?: string; // رابط Google Meet/Jitsi الذي تم فيه التدريب
  examPassed: boolean;
  examScore?: number;
  certifiedAt?: string;
}


export interface PublisherOrder {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  publisherShare: number;
  status: string;
  createdAt: string;
}



export interface WithdrawalRequest {
  id: string;
  instructorId: string;
  amount: number;
  method: string;
  status: 'pending' | 'processed';
  createdAt: string;
}

export interface ChildProfile {
  id: string;
  userProfileId: string;
  fullName: string;
  birthDate: string | null;
  /** ذكر/أنثى — تُستخدم في صياغة القصة. كانت تُجمع في المعالج وتُهمل. */
  gender?: 'male' | 'female' | null;
  avatarUrl?: string | null;
  createdAt: string;
  /**
   * حساب الدخول الخاص بالطفل نفسه، لو ولي الأمر فتحه.
   *
   * ⚠️ مش `userProfileId` — ده معرّف **ولي الأمر**، وهو اللي بيربط
   * الطفل بعائلته. الحقل ده هو حساب الطفل هو.
   */
  accountProfileId?: string | null;
}

export interface Session {
  id: string;
  courseSubscriptionId: string;
  instructorId?: string;
  sessionNumber: number;
  scheduledAt: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export type SessionWithDetails = Session & {
  /** The meeting room for this session. The dashboards used to link to
   *  https://meet.google.com — Google Meet's home page, not a room. */
  meetingUrl?: string;
  userId: string;
  participantType: 'self' | 'child';
  childId?: string;
  packageId: string;
  /** اسم الباقة — الشاشات كانت بتعرض `packageId` الخام («pkg-3») للعميل. */
  packageName?: string;
  /** الرقم المرجعي للحجز (ALR-000012-R3) — هو «رقم الحجز» عند العميل، لا معرّف الجلسة. */
  paymentReference?: string;
};
