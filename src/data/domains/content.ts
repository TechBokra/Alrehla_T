import { decodeSlug } from '@/lib/utils';
import {
  WritingPackage, Instructor, PersonalizedProduct, AddonProduct, SubscriptionTier, 
  Testimonial, CreativeService, BlogPost, UserProfile, Booking, Order, 
  Publisher, InstructorPayout, PublisherPayout, SessionMessage, SessionAttachment, 
  StudyMaterial, InstructorStudent, BoxSubscription, SupportTicket, 
  JoinRequest, SupportSessionRequest, AuditLog, ServiceOrder, CourseSubscription, 
  SupportTicketMessage, FamilyMember, NotificationItem, UserRole,
  PublisherOrder,
  InstructorPricingOption, PricingFormulaSettings, InstructorCompensationProfile, InstructorCertification
} from '@/types';
import { cookies } from 'next/headers';

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
  /** Site imagery, by slot. See src/lib/site-images.ts. */
  images: SiteImages;
}

/** Used only when the settings row has no wallet number saved yet. */
export const DEFAULT_PAYMENT_WALLET = '01063335517';

// cache() بتخلي الإعدادات تُقرأ **مرة واحدة** لكل عرض للصفحة بدل ما تتقرا
// في الهيدر وفي الصفحة نفسها — استعلامين بقوا واحد في كل صفحة في الموقع.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  // عميل بلا كوكيز عن قصد: ده بيخلي الصفحات العامة قابلة للتخزين المؤقت.
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('site_settings')
    .select('value')
    .eq('key', 'general')
    .single();

  if (error || !data) {
    return {
      siteName: '',
      contactEmail: '',
      facebookUrl: '',
      instagramUrl: '',
      paymentWalletNumber: DEFAULT_PAYMENT_WALLET,
      paymentQrUrl: '',
      contactPhone: '',
      whatsappNumber: '',
      address: '',
      workingHours: '',
      announcement: { enabled: false, text: '', until: '' },
      instructorPriceAlert: 0,
      sessionRecording: DEFAULT_RECORDING_SETTINGS,
      images: {},
    };
  }

  const value = data.value as unknown as Partial<SiteSettings>;
  return {
    siteName: value.siteName ?? '',
    contactEmail: value.contactEmail ?? '',
    facebookUrl: value.facebookUrl ?? '',
    instagramUrl: value.instagramUrl ?? '',
    paymentWalletNumber: value.paymentWalletNumber || DEFAULT_PAYMENT_WALLET,
    paymentQrUrl: value.paymentQrUrl ?? '',
    contactPhone: value.contactPhone ?? '',
    whatsappNumber: value.whatsappNumber ?? '',
    address: value.address ?? '',
    workingHours: value.workingHours ?? '',
    announcement: {
      enabled: value.announcement?.enabled ?? false,
      text: value.announcement?.text ?? '',
      until: value.announcement?.until ?? '',
    },
    instructorPriceAlert: Number(value.instructorPriceAlert) || 0,
    // ⚠️ الافتراضي **مقفول**: لو الصف اتقرا غلط لأي سبب، الشاشات
    //    تسكت عن التسجيل — مش تقول لولي أمر إن ابنه بيتسجّل وهو مش
    //    متسجّل، ولا العكس.
    sessionRecording: {
      enabled: value.sessionRecording?.enabled === true,
      retentionDays:
        Number(value.sessionRecording?.retentionDays) > 0
          ? Number(value.sessionRecording?.retentionDays)
          : DEFAULT_RETENTION_DAYS,
    },
    images: value.images ?? {},
  };
});

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import type { SiteImages } from '@/lib/site-images';
import {
  DEFAULT_RECORDING_SETTINGS,
  DEFAULT_RETENTION_DAYS,
  type SessionRecordingSettings,
} from '@/lib/session-recording';
import { CONTENT_DEFAULTS, type SiteContent } from '@/lib/site-content';

/**
 * نصوص الصفحات.
 *
 * بتُقرأ مرة واحدة لكل عرض للصفحة (React.cache بيمنع تكرار الاستعلام لو
 * أكتر من مكوّن في نفس الصفحة طلبها)، وبترجع النص الأصلي من الكود لأي
 * مفتاح الإدارة ما عدّلتوش — فالصفحة عمرها ما بتفضى لو الجدول فاضي أو
 * لو الاتصال بقاعدة البيانات وقع.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('page_content').select('key, value');

  if (error || !data) {
    if (error) console.error('Error fetching page content:', error);
    return { ...CONTENT_DEFAULTS };
  }

  const overrides: Record<string, string> = {};
  for (const row of data) {
    // نص فاضي في قاعدة البيانات مش تعديل — بنرجّع الأصلي.
    if (typeof row.value === 'string' && row.value.trim() !== '') {
      overrides[row.key] = row.value;
    }
  }

  return { ...CONTENT_DEFAULTS, ...overrides };
});

export const getTestimonials = async (): Promise<Testimonial[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('testimonials')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((t: any) => ({
    id: t.id,
    authorName: t.author_name,
    authorRole: t.author_role,
    content: t.content
  }));
};

export const getBlogPosts = async (
  options: { includeDrafts?: boolean } = {}
): Promise<BlogPost[]> => {
  const supabase = createPublicClient();
  // A post dated in the future is a draft: the public listing must not show it.
  const query = supabase.from('blog_posts').select('*');
  if (!options.includeDrafts) {
    query.lte('published_at', new Date().toISOString());
  }
  const { data, error } = await query.order('published_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    coverImageUrl: p.cover_image_url || undefined,
    authorName: p.author_name || 'فريق الرحلة',
    publishedAt: p.published_at
  }));
};

/**
 * مقال واحد بالاسم اللي في الرابط.
 *
 * الأسماء عربية، فالمتصفح بيشفّرها في الرابط (%D8%A7…). والصفحة كانت
 * بتقارن النص المشفّر باللي متخزّن في القاعدة (عربي عادي)، فالمقارنة
 * بتفشل والمقال بيطلع «غير موجود» رغم إنه ظاهر في القايمة.
 *
 * بنجرّب الاتنين: بعد فك التشفير، ولو ما لقيناش، بالنص زي ما جه.
 */
export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  const supabase = createPublicClient();

  const decoded = decodeSlug(slug);
  const candidates = decoded === slug ? [slug] : [decoded, slug];

  for (const candidate of candidates) {
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', candidate)
      .lte('published_at', new Date().toISOString())
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        coverImageUrl: data.cover_image_url || undefined,
        authorName: data.author_name || 'فريق الرحلة',
        publishedAt: data.published_at,
      };
    }
  }

  return null;
};

export const getBlogPostById = async (id: string): Promise<BlogPost | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    content: data.content,
    coverImageUrl: data.cover_image_url || undefined,
    authorName: data.author_name || 'فريق الرحلة',
    publishedAt: data.published_at,
  };
};
