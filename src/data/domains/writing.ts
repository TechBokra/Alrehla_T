import {
  WritingPackage, Instructor, PersonalizedProduct, AddonProduct, SubscriptionTier, 
  Testimonial, CreativeService, BlogPost, UserProfile, Booking, SessionWithDetails, Order, 
  Publisher, InstructorPayout, PublisherPayout, SessionMessage, SessionAttachment, 
  StudyMaterial, InstructorStudent, BoxSubscription, SupportTicket, 
  JoinRequest, SupportSessionRequest, AuditLog, ServiceOrder, CourseSubscription, 
  SupportTicketMessage, FamilyMember, NotificationItem, UserRole,
  PublisherOrder,
  InstructorPricingOption, PricingFormulaSettings, InstructorCompensationProfile, InstructorCertification,
  BookedSlot, DayOfWeek, InstructorSession, StudentSession,
  PublicInstructor, InstructorStatus, WeeklySlot, SessionStatus
} from '@/types';
import { cookies } from 'next/headers';
import { createPublicClient } from '@/lib/supabase/public';
import { getParticipantName, getParticipantNames, participantKey } from '@/data/domains/account';
import { createClient } from '@/lib/supabase/server';
import { cairoParts } from '@/lib/timezone';
import { isSessionOverdue } from '@/lib/session-status';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Import from auth if needed




export const getWritingPackages = async (): Promise<WritingPackage[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('creative_writing_packages')
    .select('*')
    .order('created_at', { ascending: true });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    ageGroup: p.age_group,
    track: (p.track as import('@/types').PackageTrack | null) ?? null,
    price: p.price,
    durationText: p.duration_text,
    sessionsCount: p.sessions_count,
    sessionDuration: p.session_duration || undefined,
    targetAudience: p.target_audience,
    prerequisiteNote: p.prerequisite_note || undefined,
    prerequisitePackageId: p.prerequisite_package_id || undefined,
    shortDescription: p.short_description,
    fullDescription: p.full_description,
    isActive: p.is_active
  }));
};

/**
 * الأعمدة اللي تظهر للزائر — ومفيش غيرها.
 *
 * ⚠️ **متحطّش هنا عمود جديد من غير ما تسأل: هل ينفع أي زائر يقراه؟**
 *    كان الاستعلام `select('*')` بمفتاح الزائر، فـ`approved_price` و
 *    `requested_price` و`monthly_hours_committed` و`work_model` كانوا
 *    بيوصلوا للمتصفح في صفحة عامة. القايمة الصريحة هي اللي بتمنع ده.
 *
 * `weekly_schedule` موجود عن قصد: العميل محتاج يشوف المواعيد عشان يحجز.
 */
/* قايمة الأعمدة الصريحة اتشالت: المسار العام بقى بيعدّي على
   `public_instructors()` (ملف 83)، والأعمدة الآمنة اتحدّدت في **الدالة
   نفسها** مش في الكود. الفرق إن قايمة في الكود بتحدّد اللي الصفحة
   بتعرضه، والدالة بتحدّد اللي الزائر **يقدر يوصله** أصلًا. */

/**
 * صور المدربين — **مش في جدول `instructors` أصلًا**.
 *
 * ── العطل اللي ده بيقفله ────────────────────────────────────
 *
 * `Instructor.avatarUrl` موجود في النوع من زمان، وصفحة المدرب العامة
 * بتعرضه (`instructor.avatarUrl ? <Image .../> : <User />`). بس **مفيش
 * ولا استعلام واحد كان بيملاه**: جدول `instructors` مالوش عمود
 * `avatar_url` خالص. الصورة بتتحفظ في `user_profiles.avatar_url` —
 * حساب المستخدم، مش ملف المدرب.
 *
 * فالمدرب كان بيرفع صورته، وبتتحفظ صح، **وصفحته العامة ما بتعرضهاش
 * ولا مرة** — لأن الكود بيسأل عنها في الجدول الغلط. والصفحة كانت
 * بتقع على أيقونة الشخص الرمادية من غير أي رسالة خطأ.
 *
 * ⚠️ والزائر **يقدر** يقرا الصف ده: `can_see_profile(id)` فيها بند
 *    صريح «مدرب أو مقدّم خدمة: اسمه معروض على الموقع أصلًا»، والبند ده
 *    مش متوقف على `auth.uid()`. (وعشان كده ملف 82 ساب `can_see_profile`
 *    ممنوحة لـ`anon` عن قصد — سحبها كان هيكسر ده.)
 */
async function avatarsByUserId(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data } = await supabase
    .from('user_profiles')
    .select('id, avatar_url')
    .in('id', ids);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.avatar_url) map.set(row.id, row.avatar_url);
  }
  return map;
}

/** الصف كما ترجعه `public_instructors()` في القاعدة (ملف 83). */
type PublicInstructorRow = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  is_sample: boolean | null;
  status: string;
  weekly_schedule: unknown;
  avatar_url: string | null;
  package_ids: string[] | null;
};

function toPublicInstructor(row: PublicInstructorRow): PublicInstructor {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio ?? '',
    specialties: row.specialties ?? [],
    yearsExperience: row.years_experience ?? 0,
    isSample: row.is_sample ?? undefined,
    status: row.status as InstructorStatus,
    weeklySchedule: (row.weekly_schedule as WeeklySlot[]) ?? [],
    avatarUrl: row.avatar_url ?? undefined,
    // فاضية = كل الباقات (انظر `PublicInstructor.packageIds`).
    packageIds: row.package_ids ?? [],
  };
}

/** قائمة المدربين للصفحات العامة — بالأعمدة الآمنة وحدها. */
export const getPublicInstructors = async (): Promise<PublicInstructor[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('public_instructors');

  if (error || !data) {
    // ⚠️ فاضي هنا معناه «مفيش مدربين» **أو** «الدالة مش موجودة» —
    //    قاعدة (ك). لو الصفحة طلعت فاضية بعد نشر، أول حاجة تتأكد منها
    //    إن ملف 83 اتشغّل على القاعدة.
    if (error) console.error('Error loading public instructors', error);
    return [];
  }

  return (data as unknown as PublicInstructorRow[]).map(toPublicInstructor);
};

/** مدرب واحد للصفحات العامة — بالأعمدة الآمنة وحدها. */
export const getPublicInstructorById = async (
  id: string,
): Promise<PublicInstructor | null> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('public_instructor', { p_id: id });

  if (error) {
    console.error('Error loading public instructor', error);
    return null;
  }

  const row = (data as unknown as PublicInstructorRow[] | null)?.[0];
  return row ? toPublicInstructor(row) : null;
};

/**
 * كل بيانات المدرب — **للوحات فقط**.
 *
 * ⚠️ بتستخدم عميل المستخدم المسجَّل (`createClient`) مش مفتاح الزائر.
 *    كانت بتستخدم مفتاح الزائر، يعني شاشة «مستحقات المدربين» في لوحة
 *    الإدارة كانت بتقرا الأسعار بصلاحية **زائر غير مسجَّل** — وده اللي
 *    كان بيخلّي سياسة القراءة العامة على الجدول ضرورية للوحة تشتغل.
 *    بعد التغيير ده، الصفحات العامة بقت بتاخد الأعمدة الآمنة بس،
 *    واللوحات بتقرا بهوية صاحبها.
 */
export const getInstructors = async (): Promise<Instructor[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('instructors')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  const avatars = await avatarsByUserId(
    supabase,
    data.map((inst: { user_id: string }) => inst.user_id),
  );

  return data.map((inst: any) => ({
    id: inst.id,
    userId: inst.user_id,
    displayName: inst.display_name,
    bio: inst.bio,
    specialties: inst.specialties,
    yearsExperience: inst.years_experience,
    isSample: inst.is_sample,
    status: inst.status,
    // الصورة من `user_profiles` مش من `instructors` — شوف `avatarsByUserId`.
    avatarUrl: avatars.get(inst.user_id),
    trainingPassed: inst.training_passed,
    workModel: inst.work_model,
    requestedPrice: inst.requested_price || undefined,
    selectedPricingOptionId: inst.selected_pricing_option_id || undefined,
    approvedPrice: inst.approved_price || undefined,
    weeklySchedule: (inst.weekly_schedule as any[]) || [],
    pendingSchedule: (inst.pending_schedule as any[]) || undefined,
    monthlyHoursCommitted: inst.monthly_hours_committed || undefined
  }));
};

/** كل بيانات المدرب الواحد — **للوحات فقط**. نفس سبب `getInstructors`. */
export const getInstructorById = async (
  id: string
): Promise<Instructor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('instructors')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const avatars = await avatarsByUserId(supabase, [data.user_id]);

  return {
    id: data.id,
    userId: data.user_id,
    displayName: data.display_name,
    bio: data.bio,
    specialties: data.specialties,
    yearsExperience: data.years_experience,
    isSample: data.is_sample ?? undefined,
    status: data.status,
    // الصورة من `user_profiles` مش من `instructors` — شوف `avatarsByUserId`.
    avatarUrl: avatars.get(data.user_id),
    trainingPassed: data.training_passed ?? false,
    workModel: data.work_model,
    requestedPrice: data.requested_price || undefined,
    selectedPricingOptionId: data.selected_pricing_option_id || undefined,
    approvedPrice: data.approved_price || undefined,
    weeklySchedule: (data.weekly_schedule as any[]) || [],
    pendingSchedule: (data.pending_schedule as any[]) || undefined,
    monthlyHoursCommitted: data.monthly_hours_committed || undefined
  };
};





/**
 * رسائل الجلسة.
 *
 * كانت بترجّع رسالتين مكتوبتين في الكود من أشخاص مخترعين بتواريخ 2024،
 * وبتتعرض في صفحة الجلسة في لوحة الإدارة كأنها محادثة حقيقية.
 *
 * ملاحظة: عمود الربط في الجدول اسمه `booking_id` من تسمية قديمة، وبنمرّر
 * له رقم الجلسة — ده الربط الوحيد الموجود.
 */
export const getSessionMessages = async (sessionId: string): Promise<SessionMessage[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_messages')
    .select('id, booking_id, sender_profile_id, message, created_at')
    .eq('booking_id', sessionId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const senderIds = [...new Set(data.map((m) => m.sender_profile_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', senderIds);

  const nameById = new Map((profiles ?? []).map((p) => [String(p.id), p.full_name]));

  return data.map((m) => ({
    id: m.id,
    sessionId: m.booking_id,
    senderName: nameById.get(String(m.sender_profile_id)) ?? 'مستخدم',
    message: m.message,
    createdAt: m.created_at,
  }));
};

/** مرفقات الجلسة. كانت ملفين مخترعين بروابط «#» ما بتفتحش حاجة. */
export const getSessionAttachments = async (sessionId: string): Promise<SessionAttachment[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_attachments')
    .select('id, booking_id, file_name, file_url')
    .eq('booking_id', sessionId);

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    sessionId: a.booking_id,
    fileName: a.file_name,
    fileUrl: a.file_url,
  }));
};

/**
 * المواد الدراسية.
 *
 * كانت تلات مواد مخترعة مربوطة بأسماء باقات مخترعة — وكل طالب في المنصة
 * بيشوف نفس التلاتة.
 */
export const getStudyMaterials = async (): Promise<StudyMaterial[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('study_materials')
    .select('id, title, description, package_id')
    .order('title', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const packageIds = [...new Set(data.map((m) => m.package_id).filter(Boolean))] as string[];
  const { data: packages } = packageIds.length
    ? await supabase
        .from('creative_writing_packages')
        .select('id, name')
        .in('id', packageIds)
    : { data: [] as { id: string; name: string }[] };

  const packageName = new Map((packages ?? []).map((p) => [p.id, p.name]));

  return data.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? '',
    packageName: m.package_id ? (packageName.get(m.package_id) ?? '—') : '—',
  }));
};

/**
 * طلاب المدرب الحالي.
 *
 * كانت بترجّع تلات طلاب مخترعين لكل مدرب في المنصة: أسماء وتقدّم مالهمش
 * وجود في قاعدة البيانات.
 *
 * التعريف الحقيقي لـ«طالبي»: صاحب اشتراك ليه جلسة مسندة ليّا. ودي نفس
 * العلاقة اللي صلاحيات القاعدة بتستخدمها (دالة `instructor_teaches`)،
 * عشان اللي الشاشة بتعرضه يبقى هو نفسه اللي الصلاحيات بتسمح بيه.
 *
 * ملاحظة: لو المشارك طفل، النصوص مربوطة بحساب ولي الأمر — فالرقم
 * المستخدم هو رقم الحساب، والاسم المعروض هو اسم المشارك.
 */
/**
 * طلاب المدرب.
 *
 * ── ليه بقت دالة في القاعدة ─────────────────────────────────
 *
 * كانت بتقرا `course_subscriptions` مباشرةً — وصلاحيات القاعدة **مش
 * سامحة للمدرب** بقراءة الجدول ده (سياستين بس: الإدارة، وصاحب
 * الحساب). فالاستعلام كان بيرجع فاضي دايمًا والقايمة تفضل فاضية،
 * مهما كان عنده طلاب.
 *
 * والحل مش سياسة قراءة: الصلاحيات بتحمي الصفوف لا الأعمدة، فالسياسة
 * كانت هتدّي المدرب الصف كله — وفيه صورة إيصال التحويل البنكي لولي
 * الأمر والمبلغ. الدالة بترجّع الاسم والباقة والتقدم وبس.
 */
export const getInstructorStudents = async (): Promise<InstructorStudent[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('instructor_students');

  if (error || !data) {
    if (error) console.error('Error loading instructor students', error);
    return [];
  }

  return data.map((row) => ({
    // المعرّف ده هو اللي روابط «الملف» بتستخدمه، فلازم يبقى نفسه في
    // اللوحة الرئيسية وفي القايمة — كانوا مختلفين قبل كده.
    id: row.user_ref,
    // ⚠️ الرقم اللي المستندات بتتسأل بيه — مش `user_ref`. شوف ملف 89.
    documentsRef: row.documents_ref,
    name: row.participant_name,
    packageName: row.package_name,
    sessionsCompleted: row.sessions_completed,
    totalSessions: row.sessions_total,
  }));
};

type InstructorStudentRow = {
  subscription_id: string;
  user_ref: string;
  child_ref: string | null;
  documents_ref: string;
  participant_name: string;
  package_name: string;
  sessions_total: number;
  sessions_completed: number;
  subscription_status: string;
};

type InstructorSessionRow = {
  session_id: string;
  session_number: number;
  scheduled_at: string;
  status: string;
  meeting_url: string | null;
  subscription_id: string;
  participant_name: string;
  package_name: string;
  package_id: string;
  user_ref: string;
  child_ref: string | null;
};

/**
 * جلسات المدرب، ومعاها اسم المشارك واسم الباقة.
 *
 * `getSessions()` العامة بتعمل join على `course_subscriptions`، والـjoin
 * ده **بيرجع فاضي للمدرب** لأن صلاحيات القاعدة مانعاه من الجدول. فكل
 * جلساته كانت بتاخد `userId = 'unknown'`، ومنها «مشارك غير معروف»
 * و«الطالب #»، وعدّاد «الطلاب الحاليين: 1» اللي كان بيعدّ قيمة
 * `'unknown'` واحدة مش طالب.
 */
export async function getInstructorSessions(): Promise<InstructorSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('instructor_sessions');

  if (error || !data) {
    if (error) console.error('Error loading instructor sessions', error);
    return [];
  }

  return data.map((row) => ({
    id: row.session_id,
    sessionNumber: row.session_number,
    scheduledAt: row.scheduled_at,
    status: row.status as InstructorSession['status'],
    meetingUrl: row.meeting_url ?? undefined,
    courseSubscriptionId: row.subscription_id,
    participantName: row.participant_name,
    packageName: row.package_name,
    packageId: row.package_id,
    studentRef: row.user_ref,
    childId: row.child_ref ?? undefined,
  }));
}

/**
 * جلسات المتعلّم — للطالب البالغ وللطفل صاحب الحساب التابع.
 *
 * `getSessions()` العامة بتعتمد على صلاحيات القاعدة، وهي بتدّي الجلسات
 * لصاحب الاشتراك. لكن اشتراك الطفل **صاحبه ولي الأمر**
 * (`course_subscriptions.user_id` = ولي الأمر، و`child_id` = الطفل) —
 * فحساب الطفل ما كانش هيشوف ولا جلسة.
 *
 * والحل مش سياسة قراءة على `course_subscriptions`: الصلاحيات بتحمي
 * الصفوف لا الأعمدة، والسياسة كانت هتخلي الطفل يشوف إيصال تحويل أبوه
 * والمبلغ. الدالة بترجّع الجلسة والباقة والمدرب وبس.
 */
export async function getStudentSessions(): Promise<StudentSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('student_sessions');

  if (error || !data) {
    if (error) console.error('Error loading student sessions', error);
    return [];
  }

  return data.map((row) => ({
    id: row.session_id,
    sessionNumber: row.session_number,
    scheduledAt: row.scheduled_at,
    status: row.status as StudentSession['status'],
    meetingUrl: row.meeting_url ?? undefined,
    packageName: row.package_name,
    instructorName: row.instructor_name ?? undefined,
  }));
}

export async function getBookedSlotsByInstructor(
  instructorIds: string[],
): Promise<Record<string, BookedSlot[]>> {
  const result: Record<string, BookedSlot[]> = {};
  if (instructorIds.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('instructor_id, scheduled_at, status')
    .in('instructor_id', instructorIds)
    .gte('scheduled_at', new Date().toISOString())
    .neq('status', 'cancelled');

  if (error || !data) return result;

  const DAYS: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  // (المدرب، اليوم، الساعة) ← أبعد جلسة
  const latest = new Map<string, { instructorId: string; slot: BookedSlot }>();

  for (const row of data) {
    if (!row.instructor_id) continue;
    const at = new Date(row.scheduled_at);
    if (Number.isNaN(at.getTime())) continue;

    const p = cairoParts(at);
    const day = DAYS[p.weekday];
    const time = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
    const key = `${row.instructor_id}|${day}|${time}`;

    const current = latest.get(key);
    if (!current || new Date(current.slot.bookedUntil) < at) {
      latest.set(key, {
        instructorId: row.instructor_id,
        slot: { day, time, bookedUntil: at.toISOString() },
      });
    }
  }

  for (const { instructorId, slot } of latest.values()) {
    (result[instructorId] ??= []).push(slot);
  }

  return result;
}

export async function getCourseSubscriptions(): Promise<CourseSubscription[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('course_subscriptions')
    .select('id, package_id, user_id, participant_type, child_id, status, started_at, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    packageId: row.package_id,
    userId: row.user_id,
    participantType: row.participant_type as CourseSubscription['participantType'],
    childId: row.child_id ?? undefined,
    status: row.status as CourseSubscription['status'],
    startedAt: row.started_at ?? row.created_at,
    createdAt: row.created_at,
  }));
}



export async function getStudentDocuments(studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('portfolio_documents')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    studentId: d.student_id,
    title: d.title,
    content: d.content,
    status: d.status,
    instructorFeedback: d.instructor_feedback || undefined,
    updatedAt: d.updated_at || d.created_at
  }));
}

export async function getDocumentById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('portfolio_documents')
    .select('*')
    .eq('id', id)
    .single();

  if ((error || !data)) {
    return null;
  }

  return {
    id: data.id,
    studentId: data.student_id,
    title: data.title,
    content: data.content,
    status: data.status,
    instructorFeedback: data.instructor_feedback || undefined,
    updatedAt: data.updated_at || data.created_at
  };
}











export const getPricingFormulaSettings = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pricing_formula_settings')
    .select('*')
    .eq('id', 'default')
    .single();

  if (error || !data) {
    return { id: 'default', platformMultiplier: 1, fixedAdminFee: 0, updatedAt: new Date().toISOString() };
  }

  return {
    id: data.id,
    platformMultiplier: data.platform_multiplier,
    fixedAdminFee: data.fixed_admin_fee,
    updatedAt: data.updated_at
  };
};

export async function getInstructorCertification(
  instructorId: string
): Promise<InstructorCertification | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_certifications')
    .select('*')
    .eq('instructor_id', instructorId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    instructorId: data.instructor_id,
    trainingCompletedAt: data.training_completed_at ?? undefined,
    trainingMeetingLink: data.training_meeting_link ?? undefined,
    examPassed: data.exam_passed,
    examScore: data.exam_score ?? undefined,
    certifiedAt: data.certified_at ?? undefined,
  };
}

export async function getProfileUpdateRequestsByInstructor(
  instructorId: string
): Promise<import('@/types').ProfileUpdateRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profile_update_requests')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    instructorId: row.instructor_id,
    requestedChanges: (row.requested_changes ?? {}) as import('@/types').ProfileUpdateRequest['requestedChanges'],
    status: row.status as import('@/types').ProfileUpdateRequest['status'],
    adminFeedback: row.admin_feedback ?? undefined,
    createdAt: row.created_at,
  }));
}

export const getSessions = async (): Promise<SessionWithDetails[]> => {
  const supabase = await createClient();
  // اسم الباقة والرقم المرجعي بيتجابوا مع الجلسة.
  //
  // شاشة «المواعيد والجلسات» عند العميل كانت بتعرض `package_id` الخام
  // («pkg-3») تحت عنوان «الباقة»، ورقم الجلسة الداخلي (UUID) تحت عنوان
  // «رقم الحجز» — وهو مش رقم الحجز أصلًا. العميل بيشوف تلات أعمدة
  // مالهاش أي معنى عنده.
  const { data, error } = await supabase
    .from('sessions')
    .select(
      '*, course_subscriptions(*, creative_writing_packages(name))'
    )
    .order('scheduled_at', { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  return data.map((sess: any) => {
    const sub = sess.course_subscriptions;
    return {
      id: sess.id,
      courseSubscriptionId: sess.course_subscription_id,
      sessionNumber: sess.session_number,
      instructorId: sess.instructor_id || undefined,
      status: sess.status as any,
      scheduledAt: sess.scheduled_at,
      createdAt: sess.created_at,
      updatedAt: sess.updated_at || sess.created_at,
      meetingUrl: sess.meeting_url || undefined,
      // joined details
      userId: sub?.user_id || 'unknown',
      participantType: sub?.participant_type || 'self',
      childId: sub?.child_id || undefined,
      packageId: sub?.package_id || 'unknown',
      packageName: sub?.creative_writing_packages?.name || undefined,
      paymentReference: sub?.payment_reference || undefined,
    };
  });
};

export async function getInstructorPricingOptions(): Promise<InstructorPricingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_pricing_options')
    .select('*')
    .eq('is_active', true)
    .order('base_price_per_session', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((o) => ({
    id: o.id,
    label: o.label,
    basePricePerSession: o.base_price_per_session,
    isActive: o.is_active,
  }));
}

/** The latest saved report for a session, if the instructor has written one. */
export async function getSessionReport(sessionId: string): Promise<{
  attendance: 'present' | 'absent';
  report: string;
  createdAt: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_reports')
    .select('attendance, report, updated_at')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    attendance: data.attendance === 'absent' ? 'absent' : 'present',
    report: data.report ?? '',
    createdAt: data.updated_at,
  };
}

export interface AdminSessionRow {
  id: string;
  sessionNumber: number;
  scheduledAt: string;
  status: SessionStatus;
  participantName: string;
  packageName: string;
  instructorName: string | null;
  /** الرقم المرجعي للحجز — هو اللي الإدارة بتدوّر بيه، لا معرّف الجلسة. */
  paymentReference: string | null;
  attendance: 'present' | 'absent' | null;
  reportText: string;
  reportedAt: string | null;
  /** معادها فات ولا اتقفلت ولا اتلغت — بند البلاغ بالحرف. */
  isOverdue: boolean;
  /** اسم الغرفة عند Daily — فاضي = الجلسة مالهاش مكان لقاء. */
  roomName: string | null;
}

/**
 * كل الجلسات ومعاها تقاريرها — صفوف شاشة **الجلسات والتقارير**.
 *
 * ── بلاغ فريق العمل (27 سبتمبر) ─────────────────────────────
 *
 * «المدرب trainer2 أرسل تقريرًا عن حضور ميار أحمد… **لم أجد في لوحة
 *  تحكم الإدارة أي صفحة لمتابعة هذه التقارير**.»
 *
 * ⚠️ **والبلاغ دقيق.** كان في `/dashboard/admin/sessions/[id]` صفحة
 *    لجلسة واحدة — **ومفيش قايمة تودّي لها**. مفيش رابط في القايمة
 *    الجانبية، ومفيش صفحة فهرس. الطريق الوحيد ليها كان إشعار الغياب
 *    اللي ضفناه امبارح. يعني تقرير موجود في القاعدة، وشاشة تعرضه،
 *    ومفيش طريق بينهم.
 *
 * ── والقايمة بتجيب التقرير مع الجلسة ────────────────────────
 *
 * ⚠️ **مش استعلام لكل جلسة.** التقارير بتتجاب بـ`in` واحد، والأسماء
 *    بـ`getParticipantNames`، والمدربون باستعلام واحد. أربع استعلامات
 *    لأي عدد جلسات — بدل `2 + 1` لكل جلسة.
 */
export async function getSessionsForAdmin(): Promise<AdminSessionRow[]> {
  const sessions = await getSessions();
  if (sessions.length === 0) return [];

  const supabase = await createClient();

  const sessionIds = sessions.map((s) => s.id);
  const instructorIds = [
    ...new Set(sessions.map((s) => s.instructorId).filter(Boolean)),
  ] as string[];

  const [{ data: reports }, { data: instructors }, { data: rooms }, names] = await Promise.all([
    supabase
      .from('session_reports')
      .select('session_id, attendance, report, updated_at')
      .in('session_id', sessionIds),
    instructorIds.length
      ? supabase.from('instructors').select('id, display_name').in('id', instructorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    // اسم الغرفة مش في `getSessions()` — بيتجاب هنا عشان لوحة
    // الغرف تعرف مين ليه مكان لقاء ومين لأ.
    supabase.from('sessions').select('id, room_name').in('id', sessionIds),
    getParticipantNames(
      sessions.map((s) => ({ dependentId: s.childId, independentId: s.userId })),
    ),
  ]);

  const reportBySession = new Map((reports ?? []).map((r) => [r.session_id, r]));
  const roomBySession = new Map(
    (rooms ?? []).map((r) => [r.id, r.room_name as string | null]),
  );
  const instructorName = new Map((instructors ?? []).map((i) => [i.id, i.display_name]));

  return sessions.map((s) => {
    const report = reportBySession.get(s.id);
    return {
      id: s.id,
      sessionNumber: s.sessionNumber,
      scheduledAt: s.scheduledAt,
      status: s.status,
      participantName:
        names.get(participantKey(s.childId, s.userId)) ?? 'مشارك غير معروف',
      packageName: s.packageName ?? 'باقة محذوفة',
      instructorName: s.instructorId
        ? (instructorName.get(s.instructorId) ?? 'مدرب محذوف')
        : null,
      paymentReference: s.paymentReference ?? null,
      attendance: report ? (report.attendance === 'absent' ? 'absent' : 'present') : null,
      reportText: report?.report ?? '',
      reportedAt: report?.updated_at ?? null,
      isOverdue: isSessionOverdue(s),
      roomName: roomBySession.get(s.id) ?? null,
    };
  });
}

/**
 * صفوف شاشة إدارة المدربين.
 *
 * الشاشة محتاجة معلومات من ثلاث جداول: المدرب نفسه، هل عنده طلب مراجعة
 * معلّق، وهل مشترك في خدمات إبداعية معتمدة. بنجيبهم في ثلاث استعلامات
 * مجمّعة بدل استعلام لكل مدرب (اللي كان هيبقى 200 استعلام لـ200 مدرب).
 */
export interface InstructorAdminRow extends Instructor {
  hasPendingReview: boolean;
  activeServicesCount: number;
}

export const getInstructorsForAdmin = async (): Promise<InstructorAdminRow[]> => {
  const instructors = await getInstructors();
  if (instructors.length === 0) return [];

  const supabase = await createClient();
  const ids = instructors.map((i) => i.id);

  const [{ data: pending }, { data: services }] = await Promise.all([
    supabase
      .from('profile_update_requests')
      .select('instructor_id')
      .eq('status', 'pending')
      .in('instructor_id', ids),
    // العدّ من `provider_services` عبر صف مقدّم الخدمة بتاع المدرب —
    // ده الجدول اللي العميل بيشوف منه. العدّ من `instructor_services`
    // كان بيدّي الإدارة رقمًا مالوش علاقة باللي معروض فعلًا.
    supabase
      .from('provider_services')
      .select('service_providers!inner(instructor_id)')
      .eq('status', 'approved')
      .eq('is_active', true)
      .in('service_providers.instructor_id', ids),
  ]);

  const pendingSet = new Set((pending ?? []).map((r) => r.instructor_id));
  const serviceCount = new Map<string, number>();
  for (const row of services ?? []) {
    const linked = row.service_providers as unknown as { instructor_id: string | null } | null;
    const id = linked?.instructor_id;
    if (!id) continue;
    serviceCount.set(id, (serviceCount.get(id) ?? 0) + 1);
  }

  return instructors.map((inst) => ({
    ...inst,
    hasPendingReview: pendingSet.has(inst.id),
    activeServicesCount: serviceCount.get(inst.id) ?? 0,
  }));
};

/** حجز كتابة كما تراه الإدارة. */
export type AdminCourseBooking = {
  id: string;
  participantName: string;
  packageName: string;
  amount: number | null;
  status: string;
  paymentReference: string | null;
  paymentMethod: string | null;
  paymentReceiptUrl: string | null;
  preferredInstructorId: string | null;
  preferredInstructorName: string | null;
  createdAt: string;
  startedAt: string | null;
  sessionsCount: number;
  /** إهداء خاص كتبه صاحب الحجز — بيتقفل بعد الإنشاء. */
  giftMessage: string | null;
  /**
   * وقت موافقة ولي الأمر على تسجيل الجلسات.
   *
   * ⚠️ فاضي معناه حاجة من اتنين: **حجز قديم** قبل ما الميزة تشتغل،
   *    أو **الكتابة فشلت** — والتانية دي بتوصل للإدارة كإشعار وقتها.
   *    الشاشة بتفرّق بينهم بتاريخ الحجز.
   */
  recordingConsentAt: string | null;
};

/**
 * حجوزات الكتابة للإدارة.
 *
 * شاشة الحجوزات كانت مبنية على جدول **الجلسات**، وبتطابقها بطلبات
 * الخدمات بنفس الرقم («نفترض تطابق 1:1» زي ما كان مكتوب في الكود).
 * ولما وقفنا إنشاء الجلسة التلقائية بتاريخ مخترع، الحجز الجديد مكانش
 * هيظهر في أي شاشة.
 *
 * الحجز = صف في `course_subscriptions`. والجلسات بتتجدول بعد تأكيد الدفع.
 */
export async function getCourseBookingsForAdmin(): Promise<AdminCourseBooking[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('course_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return [];

  const packageIds = [...new Set(data.map((r) => r.package_id).filter(Boolean))];
  const instructorIds = [
    ...new Set(data.map((r) => r.preferred_instructor_id).filter(Boolean)),
  ] as string[];

  const [{ data: packages }, { data: instructors }, { data: sessions }] = await Promise.all([
    supabase.from('creative_writing_packages').select('id, name').in('id', packageIds),
    instructorIds.length
      ? supabase.from('instructors').select('id, display_name').in('id', instructorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    supabase.from('sessions').select('id, course_subscription_id'),
  ]);

  const packageName = new Map((packages ?? []).map((p) => [p.id, p.name]));
  const instructorName = new Map((instructors ?? []).map((i) => [i.id, i.display_name]));

  // ⚠️ كان `await getParticipantName(...)` **جوّه اللفّة** — استعلامين
  //    متسلسلين لكل حجز. بقى استعلامين للكل.
  const names = await getParticipantNames(
    data.map((row) => ({ dependentId: row.child_id ?? undefined, independentId: row.user_id })),
  );

  const rows: AdminCourseBooking[] = [];
  for (const row of data) {
    rows.push({
      id: row.id,
      participantName:
        names.get(participantKey(row.child_id ?? undefined, row.user_id)) ??
        'مشارك غير معروف',
      packageName: packageName.get(row.package_id) ?? 'باقة محذوفة',
      amount: row.amount ?? null,
      status: row.status,
      paymentReference: row.payment_reference ?? null,
      paymentMethod: row.payment_method ?? null,
      paymentReceiptUrl: row.payment_receipt_url ?? null,
      preferredInstructorId: row.preferred_instructor_id ?? null,
      preferredInstructorName: row.preferred_instructor_id
        ? (instructorName.get(row.preferred_instructor_id) ?? null)
        : null,
      createdAt: row.created_at,
      startedAt: row.started_at ?? null,
      sessionsCount: (sessions ?? []).filter((x) => x.course_subscription_id === row.id).length,
      giftMessage: row.gift_message ?? null,
      recordingConsentAt: row.recording_consent_at ?? null,
    });
  }

  return rows;
}
