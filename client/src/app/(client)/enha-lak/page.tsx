import { getWatermarkLayer } from '@/lib/watermark';
import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'إنها لك',
    description: 'تصفح المتجر واكتشف أحدث منتجات وإصدارات إنها لك.',
    path: '/enha-lak',
  });
}

import Link from 'next/link';

import { getTestimonials } from '@/data/domains/(shared)/content/testimonials';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getPersonalizedProducts } from '@/data/domains/(client)/products/queries';
import { getSubscriptionTiers } from '@/data/domains/(shared)/subscriptions/plans';
import { getPaymentAvailability } from '@/data/domains/(shared)/payments/queries';
import { getDeliveryPause } from '@/data/domains/(client)/shipping/queries';
import { METHOD_LABELS } from '@/lib/payments/settings';
import { REVIEW_DELAY_NOTE, daysLabel } from '@/lib/delivery-days';
import { retentionLabel } from '@/lib/session-recording';
import { formatPrice } from '@/lib/utils';

import { PageContainer } from '@/components/PageContainer';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';




import {



  Fingerprint,
  BookOpen,
  PenTool,
  Sparkles,
  User,
  FileEdit,
  Wand2,
  Package,
  Quote,
  ArrowLeft,
  ImageIcon,
  Clock,
  CreditCard,
  Truck,
} from 'lucide-react';
import { AdSlot } from '@/components/ads/AdSlot';




export default async function EnhaLakPage() {
  // آراء القسم ده وحده — رأي عن الجلسات مالوش مكان في صفحة القصص.
  const [testimonials, content, settings, wm, products, tiers, payment, pause] = await Promise.all([
    getTestimonials('enha_lak'),
    getSiteContent(),
    getSiteSettings(),
    getWatermarkLayer(), // «على الكل»
    getPersonalizedProducts(),
    getSubscriptionTiers(),
    getPaymentAvailability(),
    getDeliveryPause(),
  ]);

  // «من كام» على كل مسار — من الأسعار الحقيقية (أرخص نسخة متاحة).
  const fromPrice = (category: 'custom' | 'library'): number | null => {
    const prices = products
      .filter((p) => p.category === category)
      .flatMap((p) => [p.price, p.electronicPrice ?? 0])
      .filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : null;
  };
  const boxFrom = tiers.length ? Math.min(...tiers.map((t) => t.priceMonthly).filter((n) => n > 0)) : null;

  const paths = [
    { href: '/enha-lak/custom', key: 'path1', icon: PenTool, tone: 'bg-violet-50 text-violet-600', hover: 'hover:border-violet-300 hover:shadow-violet-500/10', from: fromPrice('custom'), unit: '' },
    { href: '/enha-lak/library', key: 'path2', icon: BookOpen, tone: 'bg-emerald-50 text-emerald-600', hover: 'hover:border-emerald-300 hover:shadow-emerald-500/10', from: fromPrice('library'), unit: '' },
    { href: '/enha-lak/subscription', key: 'path3', icon: Package, tone: 'bg-purple-50 text-purple-600', hover: 'hover:border-purple-300 hover:shadow-purple-500/10', from: Number.isFinite(boxFrom) ? boxFrom : null, unit: ' / شهريًا' },
  ];

  // شريط الثقة — كل سطر من إعداد حقيقي، مش وعد مكتوب بإيد.
  const days = settings.deliveryDays;
  const paymentLine =
    payment.mode === 'gateway' && payment.methods.length > 0
      ? payment.methods.map((m) => METHOD_LABELS[m]).join(' · ')
      : 'تحويل إنستاباي أو محفظة';
  const trust = [
    { icon: ImageIcon, title: 'صورة البطل بموافقتك', text: 'بنبعتهالك تعتمدها قبل رسم الصفحات.' },
    { icon: Clock, title: 'مدة التجهيز', text: `الإلكترونية ${daysLabel(days.electronic)} · المطبوعة ${daysLabel(days.printed)} + الشحن` },
    { icon: CreditCard, title: 'الدفع', text: paymentLine },
    pause.paused
      ? { icon: Truck, title: 'التوصيل متوقف مؤقتًا', text: 'النسخ الإلكترونية متاحة عادي.' }
      : { icon: Truck, title: 'توصيل لباب البيت', text: 'أو نسخة إلكترونية على الإيميل.' },
  ];

  // أسئلة بتتسأل قبل الطلب — الإجابات من الإعدادات نفسها.
  const faqs = [
    {
      q: 'القصة بتاخد قد إيه؟',
      a: `النسخة الإلكترونية بتجهز خلال ${daysLabel(days.electronic)} من تأكيد الطلب، والمطبوعة خلال ${daysLabel(days.printed)} وبعدها الشحن. بعض الكتب ليها مدة مختلفة ومكتوبة في صفحتها.`,
    },
    { q: 'هشوف حاجة قبل ما تخلص؟', a: `أيوه — ${REVIEW_DELAY_NOTE}` },
    {
      q: 'صورة طفلي بتروح فين؟',
      a: `بيشوفها فريق التنفيذ بس، وبتستخدم في رسم القصة بس، وبتتحذف تلقائيًا بعد ${retentionLabel(settings.childPhotoRetentionDays)} من انتهاء الطلب.`,
    },
    {
      q: 'إيه الفرق بين الإلكترونية والمطبوعة؟',
      a: 'الإلكترونية ملف بيوصلك على الإيميل من غير شحن. المطبوعة كتاب حقيقي بيتشحن لعنوانك، وفي كتب تقدر تاخد الاتنين مع بعض.',
    },
    { q: 'بدفع إزاي؟', a: payment.mode === 'gateway' ? `أونلاين: ${paymentLine}.` : 'بالتحويل (إنستاباي أو محفظة)، وبترفع صورة الإيصال بعدها.' },
  ];

  // الشرائح كانت في layout القسم، يعني بتظهر فوق كل صفحة جواه. مكانها
  // الصفحة الرئيسية للقسم وبس.


  // الأيقونات والألوان ثابتة؛ النصوص من لوحة الإدارة ← محتوى الصفحات.
  const benefits = [
    { key: 'benefit1', icon: Fingerprint, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'benefit2', icon: BookOpen, color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'benefit3', icon: Sparkles, color: 'text-rose-600', bg: 'bg-amber-50' },
  ].map((b) => ({
    ...b,
    title: content[`enhaLak.${b.key}.title`],
    description: content[`enhaLak.${b.key}.text`],
  }));

  const steps = [
    { key: 'step1', icon: User },
    { key: 'step2', icon: FileEdit },
    { key: 'step3', icon: Wand2 },
    { key: 'step4', icon: Package },
  ].map((s) => ({
    ...s,
    title: content[`enhaLak.${s.key}.title`],
    // ⚠️ خطوة الاستلام بتاخد المدة من «الإعدادات» — عشان الصفحة ماتقولش
    //    رقم والإعدادات (وصفحة المنتج) رقم تاني.
    description:
      s.key === 'step4'
        ? `الإلكترونية خلال ${daysLabel(settings.deliveryDays.electronic)} على الإيميل، والمطبوعة خلال ${daysLabel(settings.deliveryDays.printed)} وبعدها الشحن.`
        : content[`enhaLak.${s.key}.text`],
  }));

  return (
    <>
      {/* ⚠️ **البانر برّه `PageContainer` عن قصد** — الإطار بيحط
          `px-6 md:px-12`، والصورة المفروض بعرض الشاشة كامل زي
          الرئيسية وأقلام الرحلة. */}
      <PageHero
        image={settings.images.enhaLakSlide1}
        watermark={wm}
        title={content['enhaLak.hero.title']}
        subtitle={content['enhaLak.hero.subtitle']}
        bandClassName="bg-rose-50"
        links={[
          { href: '/enha-lak/custom', label: content['enhaLak.path1.title'] },
          { href: '/enha-lak/library', label: content['enhaLak.path2.title'], look: 'outline' },
          { href: '/enha-lak/subscription', label: content['enhaLak.path3.title'], look: 'outline' },
        ]}
      />
      <AdSlot page="enha-lak" position="top" />
    <PageContainer className="!py-0 !space-y-0">
      {/* Path Selection */}
      <Section containerClassName="max-w-5xl">
        <div className="grid gap-8 md:grid-cols-3">
          {paths.map((path) => {
            const Icon = path.icon;
            return (
              <Link key={path.key} href={path.href} className="group block h-full">
                <Card
                  accentColor="rose"
                  className={`relative flex h-full flex-col overflow-hidden p-8 text-center transition-[box-shadow,transform,border-color] duration-[var(--dur-ui)] ease-[var(--ease-ui)] motion-safe:hover:-translate-y-1 hover:shadow-xl md:text-right ${path.hover}`}
                >
                  <div
                    className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-[var(--dur-ui)] ease-[var(--ease-ui)] motion-safe:group-hover:scale-110 md:mx-0 ${path.tone}`}
                  >
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-slate-800">{content[`enhaLak.${path.key}.title`]}</h3>
                  <p className="mb-6 leading-relaxed font-medium text-slate-600">{content[`enhaLak.${path.key}.text`]}</p>
                  {/* «من كام» + سهم — العميل يعرف السعر التقريبي قبل ما يدخل. */}
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                    <span className="text-sm font-bold text-slate-700">
                      {path.from ? `من ${formatPrice(path.from)}${path.unit}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-black text-rose-700">
                      ابدأ
                      <ArrowLeft className="h-4 w-4 transition-transform motion-safe:group-hover:-translate-x-1" aria-hidden="true" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* ══ شريط الثقة ══ */}
        <ul className="mt-10 grid gap-4 rounded-3xl border border-slate-100 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-black text-slate-800">{t.title}</span>
                  <span className="block text-sm font-medium text-slate-600">{t.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Power of Personalization */}
      <Section containerClassName="max-w-6xl rounded-3xl border border-slate-100 bg-slate-50/50 p-8 md:p-12">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['enhaLak.benefits.title']}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="text-center">
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${benefit.bg} ${benefit.color} mb-6`}
                >
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-800">
                  {benefit.title}
                </h3>
                <p className="leading-relaxed font-medium text-slate-500">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* How it works */}
      <Section containerClassName="max-w-5xl">
        <h2 className="mb-16 text-center text-3xl font-black text-slate-800">
          {content['enhaLak.steps.title']}
        </h2>
        <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="absolute top-8 right-12 left-12 -z-10 hidden h-0.5 bg-slate-100 md:block"></div>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative text-center">
                <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-violet-100 bg-white text-violet-600 shadow-sm">
                  <Icon className="h-7 w-7" />
                  <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {index + 1}
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-800">
                  {step.title}
                </h3>
                <p className="text-sm font-medium text-slate-500">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ⚠️ كان بيظهر فاضي: عنوان «من تجاربهم» من غير ولا تجربة. */}
      {testimonials.length > 0 && (
      <Section containerClassName="max-w-6xl pb-24">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['enhaLak.testimonials.title']}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              accentColor="rose"
              className="flex flex-col justify-between p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <Quote className="mb-4 h-8 w-8 text-blue-200" />
                <p className="mb-6 leading-relaxed font-medium text-slate-600 italic">
                  "{testimonial.content}"
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-800">
                  {testimonial.authorName}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {testimonial.authorRole}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>
      )}

      {/* ══ أسئلة قبل الطلب ══ */}
      <Section containerClassName="max-w-3xl">
        <h2 className="mb-8 text-center text-3xl font-black text-slate-800">أسئلة بتتسأل كتير</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-5 open:shadow-sm">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-800">
                {f.q}
                <span className="text-xl leading-none text-rose-600 transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed font-medium text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ⚠️ **الصفحة كانت بتخلص من غير ولا زرار** — اللي قرا لحد هنا
          مقتنع، ومالقاش يروح فين غير إنه يطلع للقايمة فوق. (ملاحظة
          فريق العمل.) */}
      <Section containerClassName="max-w-4xl pb-24 text-center">
        <h2 className="mb-8 text-3xl font-black text-slate-800">
          {content['enhaLak.cta.title']}
        </h2>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button href="/enha-lak/custom" accentColor="enhaLak">
            {content['enhaLak.cta.custom']}
          </Button>
          <Button href="/enha-lak/library" variant="secondary" accentColor="enhaLak">
            {content['enhaLak.cta.library']}
          </Button>
          <Button href="/enha-lak/subscription" variant="secondary" accentColor="enhaLak">
            {content['enhaLak.cta.box']}
          </Button>
        </div>
      </Section>
    <AdSlot page="enha-lak" position="bottom" />
    </PageContainer>
    </>
  );
}
