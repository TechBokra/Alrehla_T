'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SupportTicketForm } from './SupportTicketForm';
import {
  Search,
  MessageCircle,
  Mail,
  Ticket,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';

export default function SupportClient({ isSignedIn }: { isSignedIn: boolean }) {
  const [activeTab, setActiveTab] = useState('enha-lak');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const tabs = [
    { id: 'enha-lak', label: 'إنها لك' },
    { id: 'creative-writing', label: 'بداية الرحلة' },
    { id: 'partners', label: 'الشركاء' },
    { id: 'general', label: 'عامة' },
  ];

  const faqs: Record<string, { q: string; a: string }[]> = {
    'enha-lak': [
      {
        q: 'كيف يمكنني تتبع طلبي؟',
        a: 'يمكنك تتبع طلبك من لوحة التحكم في قسم "مكتبتي" باستخدام رقم الطلب.',
      },
      {
        q: 'كم يستغرق شحن القصة المخصصة؟',
        a: 'القصة الإلكترونية جاهزة خلال 3-5 أيام عمل، والمطبوعة خلال 7-10 أيام عمل، بخلاف مدة الشحن حسب المحافظة.',
      },
      {
        q: 'هل يمكنني تعديل القصة بعد الطلب؟',
        a: 'لا يمكن التعديل بعد مرور 24 ساعة من الطلب لأن القصة تُطبع خصيصًا لطفلك بناءً على البيانات المدخلة.',
      },
    ],
    'creative-writing': [
      {
        q: 'هل يمكنني تغيير موعد الجلسة؟',
        a: 'نعم، يمكنك تغيير الموعد بالتنسيق مع المدرب، شرط إبلاغ الفريق قبل 24 ساعة على الأقل من موعد الجلسة لتجنب احتسابها.',
      },
      {
        q: 'ما المنصة المستخدمة للجلسات؟',
        a: 'تُعقد الجلسات عبر Google Meet أو Dooly، ويصلك رابط الجلسة مع تفاصيل موعدها، وستصلك روابط الدخول عبر البريد الإلكتروني.',
      },
      {
        q: 'كيف أختار المدرب؟',
        a: 'يمكنك استعراض ملفات المدربين من صفحة المدربين، واختيار المدرب الأنسب لك عند حجز الباقة.',
      },
      {
        q: 'ماذا يحدث إذا غبت عن الموعد؟',
        a: 'يتم احتساب الجلسة في حالة التغيب دون عذر مسبق يتم إبلاغنا به قبل 24 ساعة على الأقل.',
      },
    ],
    partners: [
      {
        q: 'كيف يمكن لدار نشر أن تعرض كتبها؟',
        a: 'نرحب بدور النشر التي تشاركنا نفس الرؤية. يرجى إرسال تفاصيل إصداراتكم عبر نموذج التذكرة باختيار "شراكات".',
      },
      {
        q: 'كيف أقدّم عرض خدمة أو منتج كشريك؟',
        a: 'يمكنك تقديم عرضك عبر نموذج التواصل أسفل الصفحة، وسيقوم فريقنا بمراجعته والرد عليك.',
      },
      {
        q: 'كيف تتم مراجعة واعتماد الشركاء؟',
        a: 'نقوم بمراجعة جميع الطلبات للتأكد من توافق المنتجات أو الخدمات مع معايير المنصة وقيمها التربوية قبل الاعتماد.',
      },
    ],
    general: [
      {
        q: 'ما طرق الدفع المتاحة؟',
        a: 'الدفع حاليًا بالتحويل على المحفظة الإلكترونية أو إنستاباي. الدفع بالبطاقة سيُتاح عند ربط بوابة دفع رسمية.',
      },
      {
        q: 'ما سياسة الاسترداد؟',
        a: 'يختلف الاسترداد حسب الخدمة؛ المنتجات المخصصة غير قابلة للاسترداد بعد بدء العمل، بينما يمكن استرداد بعض الخدمات قبل بدئها. يرجى مراجعة الشروط والأحكام.',
      },
      {
        q: 'كيف أدير حسابي؟',
        a: 'يمكنك إدارة حسابك من خلال لوحة التحكم بعد تسجيل الدخول لتحديث بياناتك أو متابعة طلباتك.',
      },
      {
        q: 'أين أجد سياسة الخصوصية؟',
        a: 'يمكنك العثور على سياسة الخصوصية الخاصة بنا بالضغط على الرابط في أسفل هذه الصفحة.',
      },
    ],
  };

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Hero Section */}
      <Section containerClassName="max-w-4xl space-y-6 text-center">
        <h1 className="text-4xl leading-tight font-black text-slate-900 md:text-6xl">
          كيف يمكننا مساعدتك؟
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
          ابحث عن إجابتك، أو تواصل معنا إذا لم تجد ما تحتاجه.
        </p>
        <div className="relative mx-auto mt-8 max-w-xl">
          <input
            type="text"
            placeholder="ابحث في الأسئلة: الدفع، الشحن، الجلسات، الحساب..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 pr-12 font-medium text-slate-700 shadow-sm transition-all outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          <Search className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
        </div>
      </Section>

      {/* FAQs Section */}
      <Section containerClassName="max-w-4xl">
        {/* Tabs */}
        <div className="mb-10 flex flex-wrap justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setOpenFaqIndex(null);
              }}
              className={`flex-1 rounded-xl px-6 py-3 text-sm font-bold whitespace-nowrap transition-all md:flex-none ${
                activeTab === tab.id
                  ? 'bg-white text-amber-600 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs[activeTab].map((faq, idx) => (
            <Card
              key={idx}
              accentColor="amber"
              className="overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() =>
                  setOpenFaqIndex(openFaqIndex === idx ? null : idx)
                }
                className="flex w-full items-center justify-between p-6 text-right outline-none"
              >
                <span className="text-lg font-bold text-slate-800">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openFaqIndex === idx ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden px-6 transition-all duration-300 ease-in-out ${
                  openFaqIndex === idx
                    ? 'max-h-40 pb-6 opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
              >
                <p className="leading-relaxed font-medium text-slate-600">
                  {faq.a}
                </p>
                {faq.q.includes('الخصوصية') && (
                  <Link
                    href="/privacy"
                    className="mt-2 inline-flex items-center gap-1 font-bold text-amber-600 hover:underline"
                  >
                    اقرأ سياسة الخصوصية <ArrowLeft className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Contact Section */}
      <Section containerClassName="max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          قنوات التواصل
        </h2>

        <div className="grid items-start gap-8 md:grid-cols-3">
          <Card accentColor="amber" className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-800">واتساب</h3>
            <p className="mb-6 font-medium text-slate-500">
              راسلنا عبر واتساب
            </p>
            <Button
              className="w-full !bg-green-500 !hover:bg-green-600 shadow-md"
              accentColor="amber"
            >
              ابدأ المحادثة
            </Button>
          </Card>

          <Card accentColor="amber" className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-800">
              البريد الإلكتروني
            </h3>
            <p className="mb-6 font-medium text-slate-500">
              للشكاوى والمقترحات
            </p>
            <Button
              href="mailto:Alrehla@tech-bokra.com"
              variant="secondary"
              accentColor="amber"
              className="w-full !bg-slate-100 !text-slate-700 !border-0 !hover:bg-slate-200"
            >
              Alrehla@tech-bokra.com
            </Button>
          </Card>

          <Card accentColor="amber" className="p-8 md:col-span-1 md:row-span-2">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Ticket className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                افتح تذكرة دعم
              </h3>
            </div>
            <p className="mb-6 text-sm font-medium text-slate-500">
              لم تجد إجابة؟ أرسل لنا تذكرة وسنرد عليك في أقرب وقت.
            </p>

            <SupportTicketForm isSignedIn={isSignedIn} />
          </Card>
        </div>
      </Section>

      {/* Join Us Link */}
      <div className="mt-12 pb-16 w-full text-center">
        <p className="inline-flex items-center gap-2 text-lg font-medium text-slate-600">
          هل ترغب في الانضمام لفريقنا؟{' '}
          <Link
            href="/join-us"
            className="flex items-center gap-1 font-bold text-amber-600 hover:underline"
          >
            قدم طلبك هنا <ArrowLeft className="h-4 w-4" />
          </Link>
        </p>
      </div>
    </PageContainer>
  );
}
