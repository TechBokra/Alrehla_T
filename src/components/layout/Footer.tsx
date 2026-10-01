/*
 * ⚠️ `min-h-[44px]` (و`w-11 h-11` = 44px) — أصغر هدف لمس مقبول.
 *
 * القياس على الموقع المنشور بعرض 375px: **17 عنصر قابل للضغط من 35
 * تحت الـ44px**. أسوأهم روابط الفوتر: **20px** ارتفاعًا — أقل من نص
 * حجم الإصبع.
 *
 * `max-md:` على قوائم الروابط عن قصد: الموبايل بياخد الهدف الكامل،
 * والديسكتوب (ماوس، ودقة تصويب أعلى) بيحتفظ بكثافته. أزرار الأيقونات
 * بتاخد 44px على كل المقاسات — هي صغيرة في الحالتين.
 */
import Link from 'next/link';
import Image from 'next/image';
import { getSiteSettings, getSiteContent } from '@/data/domains/content';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { Mail, Phone, MapPin, Clock, MessageCircle, Facebook, Instagram } from 'lucide-react';

/** روابط الفوتر — الرابط ثابت والنص من «محتوى الصفحات» ← الفوتر. */
const QUICK_LINKS = [
  { key: 'about', href: '/about' },
  { key: 'enhaLak', href: '/enha-lak' },
  { key: 'creativeWriting', href: '/creative-writing' },
  { key: 'blog', href: '/blog' },
  { key: 'joinUs', href: '/join-us' },
  { key: 'support', href: '/support' },
] as const;
const LEGAL_LINKS = [
  { key: 'privacy', href: '/privacy' },
  { key: 'terms', href: '/terms' },
] as const;
const LINK_CLASS =
  'inline-flex max-md:min-h-[44px] items-center transition-colors focus-visible:text-brand-strong focus-visible:underline focus-visible:outline-none hover:text-brand-strong';

/**
 * الفوتر.
 *
 * «الشعار على خلفية داكنة» كان بيترفع من لوحة الإدارة و**ما بيظهرش في أي
 * مكان** — الفوتر ما كانش فيه صورة أصلًا، اسم نصي بس. دلوقتي بيستخدمه،
 * وبيرجع للشعار العادي لو النسخة الداكنة مترفعتش.
 */
export default async function Footer() {
  const [settings, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
  const logo = settings.images.logoDark || settings.images.logo;
  const siteName = settings.siteName || 'منصة الرحلة';

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-8 md:px-12 md:py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row md:items-start">
        <div className="space-y-4 text-center md:text-right">
          <Link href="/" className="inline-block">
            {logo ? (
              <span className="relative block h-12 w-36">
                <Image
                  src={optimizedImageUrl(logo, 300)}
                  alt="الرحلة"
                  fill
                  sizes="144px"
                  className="object-contain"
                />
              </span>
            ) : (
              // ⚠️ كان `amber-500` على أبيض = 2.1:1 (المطلوب 4.5). بيظهر بس
              //    لو مفيش شعار مرفوع — الشعار المرفوع كحلي وتباينه سليم.
              <span className="block text-2xl font-black tracking-tighter text-amber-800">
                الرحلة
              </span>
            )}
          </Link>
          {/* من «محتوى الصفحات» ← الفوتر — كانت مكتوبة في الكود. */}
          <p className="max-w-xs text-sm text-slate-600">{content['footer.description']}</p>

          {/* بيانات التواصل بتتظبط من «الإعدادات العامة». اللي فاضي بيختفي
              بدل ما يسيب سطر بلا قيمة. */}
          <div className="flex flex-col items-center gap-2 text-sm font-medium text-slate-600 md:items-start">
            {settings.contactPhone && (
              <a
                href={`tel:${settings.contactPhone.replace(/\s/g, '')}`}
                className="flex max-md:min-h-[44px] items-center gap-2 transition-colors hover:text-brand-strong"
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span dir="ltr">{settings.contactPhone}</span>
              </a>
            )}
            {settings.whatsappNumber && (
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex max-md:min-h-[44px] items-center gap-2 transition-colors hover:text-brand-strong"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                واتساب
              </a>
            )}
            {settings.contactEmail && (
              <a
                href={`mailto:${settings.contactEmail}`}
                className="flex max-md:min-h-[44px] items-center gap-2 transition-colors hover:text-brand-strong"
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span dir="ltr">{settings.contactEmail}</span>
              </a>
            )}
            {settings.address && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                {settings.address}
              </p>
            )}
            {settings.workingHours && (
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                {settings.workingHours}
              </p>
            )}
          </div>

          {/* ⚠️ روابط فيسبوك وإنستجرام كانت بتتكتب في «الإعدادات العامة»
              و**مابتظهرش في أي مكان** في الموقع. */}
          {(settings.facebookUrl || settings.instagramUrl) && (
            <div className="flex items-center justify-center gap-2 md:justify-start">
              {settings.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="صفحتنا على فيسبوك"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-brand-strong hover:text-brand-strong"
                >
                  <Facebook className="h-5 w-5" aria-hidden />
                </a>
              )}
              {settings.instagramUrl && (
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="حسابنا على إنستجرام"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-brand-strong hover:text-brand-strong"
                >
                  <Instagram className="h-5 w-5" aria-hidden />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-x-12 gap-y-8 md:justify-end">
          <div className="space-y-3">
            <h4 className="text-sm font-black tracking-widest text-slate-800 uppercase">
              {content['footer.quickLinksTitle']}
            </h4>
            <div className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              {QUICK_LINKS.map((l) => (
                <Link key={l.key} href={l.href} className={LINK_CLASS}>
                  {content[`footer.link.${l.key}`]}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-black tracking-widest text-slate-800 uppercase">
              {content['footer.legalTitle']}
            </h4>
            <div className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              {LEGAL_LINKS.map((l) => (
                <Link key={l.key} href={l.href} className={LINK_CLASS}>
                  {content[`footer.link.${l.key}`]}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ⚠️ كان هنا صندوق مكتوب فيه «AR - RTL Default» بخط mono —
          نص تطوير سايب في الفوتر، يعني كان **ظاهرًا لكل زائر في كل
          صفحة** في الموقع المنشور. اتشال.

          واللون اتغيّر من `slate-400` لـ`slate-500`: القياس على الموقع
          الحيّ أداه 2.63:1 والمطلوب 4.5:1. `slate-500` بيدّي 4.69:1. */}
      <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs font-medium text-slate-600 md:flex-row">
        <p>
          © {new Date().getFullYear()} {siteName}. {content['footer.copyright']}
        </p>
      </div>
    </footer>
  );
}
