import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { DEFAULT_PENDING_CANCEL_DAYS, normalizeCancelDays } from '@/lib/stale-orders';
import { DEFAULT_RECORDING_SETTINGS, DEFAULT_RETENTION_DAYS } from '@/lib/session-recording';
import { DEFAULT_WATERMARK, normalizeWatermark } from '@/lib/watermark-settings';
import { DEFAULT_MEDIA_CLEANUP, normalizeMediaCleanup } from '@/lib/media-cleanup';
import { DEFAULT_FILE_RETENTION_DAYS, normalizeRetentionDays } from '@/lib/private-files';
import { DEFAULT_CHILD_PHOTO_RETENTION_DAYS, normalizeChildPhotoDays } from '@/lib/child-photos';
import { AQLAM_OFF, normalizeAqlamSettings } from '@/lib/aqlam/settings';
import type { SiteSettings } from '@/data/domains/(shared)/settings/types';

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
      pendingOrderCancelDays: DEFAULT_PENDING_CANCEL_DAYS,
      sessionRecording: DEFAULT_RECORDING_SETTINGS,
      watermark: DEFAULT_WATERMARK,
      mediaCleanup: DEFAULT_MEDIA_CLEANUP,
      fileRetentionDays: DEFAULT_FILE_RETENTION_DAYS,
      childPhotoRetentionDays: DEFAULT_CHILD_PHOTO_RETENTION_DAYS,
      aqlam: AQLAM_OFF,
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
    // ⚠️ `??` مش `||`: صفر اختيار مقصود (الإلغاء التلقائي مقفول)، و`||`
    //    كان هيحوّله لـ٧ من غير ما الإدارة تعرف.
    pendingOrderCancelDays: normalizeCancelDays(value.pendingOrderCancelDays),
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
    watermark: normalizeWatermark(value.watermark),
    mediaCleanup: normalizeMediaCleanup(value.mediaCleanup),
    fileRetentionDays: normalizeRetentionDays(value.fileRetentionDays),
    childPhotoRetentionDays: normalizeChildPhotoDays(value.childPhotoRetentionDays),
    aqlam: normalizeAqlamSettings(value),
    images: value.images ?? {},
  };
});
