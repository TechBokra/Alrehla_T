'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SupportTicketForm } from './SupportTicketForm';
import type { Faq } from '@/lib/support-faqs';
import {
  Search,
  MessageCircle,
  Mail,
  Ticket,
  ArrowLeft,
  ChevronDown,
  Package,
  PenTool,
  NotebookPen,
  LifeBuoy,
} from 'lucide-react';

const FALLBACK_EMAIL = 'Alrehla@tech-bokra.com';

/** البحث بيتجاهل التشكيل وأشكال الألف والتاء المربوطة والياء. */
function normalize(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

export default function SupportClient({
  isSignedIn,
  whatsappNumber,
  contactEmail,
  faqs,
  text,
}: {
  isSignedIn: boolean;
  whatsappNumber?: string;
  contactEmail?: string;
  /** من «إدارة المحتوى» — القسم ← الأسئلة (`lib/support-faqs`). */
  faqs: Record<string, Faq[]>;
  /** باقي نصوص الصفحة من «إدارة المحتوى» (`support.*`). */
  text: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState('enha-lak');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const wa = whatsappNumber?.replace(/\D/g, '');
  const email = contactEmail?.trim() || FALLBACK_EMAIL;

  const tabs = [
    { id: 'enha-lak', label: 'إنها لك' },
    { id: 'creative-writing', label: 'بداية الرحلة' },
    { id: 'partners', label: 'الشركاء' },
    { id: 'general', label: 'عامة' },
  ];


  // البحث في كل الأقسام — كان مربع البحث شكل بس ومابيعملش حاجة.
  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return null;
    return tabs.flatMap((tab) =>
      (faqs[tab.id] ?? [])
        .filter((f) => normalize(`${f.q} ${f.a}`).includes(q))
        .map((f) => ({ ...f, section: tab.label })),
    );
    // `faqs` و`tabs` ثابتين جوّه الرسم.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  const shown = results ?? (faqs[activeTab] ?? []).map((f) => ({ ...f, section: '' }));

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Hero Section */}
      <Section containerClassName="max-w-4xl space-y-6 text-center">
        <h1 className="text-4xl leading-tight font-black text-slate-900 md:text-6xl">
          {text['support.title']}
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
          {text['support.subtitle']}
        </p>
        <div className="relative mx-auto mt-8 max-w-xl">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenFaqIndex(null);
            }}
            aria-label="ابحث في الأسئلة الشائعة"
            placeholder={text['support.search']}
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 pr-12 font-medium text-slate-700 shadow-sm transition-all outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          <Search className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
        </div>

        {/* اختصارات للأماكن اللي أغلب الناس بيدوروا عليها. */}
        {isSignedIn && (
          <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2 pt-2">
            {[
              { href: '/account/orders/enha-lak', label: 'طلباتي', Icon: Package },
              { href: '/account/orders/creative-writing', label: 'طلبات الخدمات', Icon: PenTool },
              { href: '/account/writing', label: 'مساحة الكتابة', Icon: NotebookPen },
              { href: '/account/support', label: 'تذاكري', Icon: LifeBuoy },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:border-amber-300 hover:text-amber-700"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* FAQs Section */}
      <Section containerClassName="max-w-4xl">
        {/* Tabs — بتختفي وقت البحث (النتايج من كل الأقسام). */}
        {results === null && (
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
        )}

        {results !== null && (
          <p className="mb-6 text-center text-sm font-bold text-slate-500">
            {results.length > 0
              ? `${results.length} نتيجة لـ«${query.trim()}»`
              : 'لا توجد نتائج — جرّب كلمة أخرى أو تواصل معنا بالأسفل.'}
          </p>
        )}

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {shown.map((faq, idx) => (
            <Card
              key={idx}
              accentColor="amber"
              className="overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() =>
                  setOpenFaqIndex(openFaqIndex === idx ? null : idx)
                }
                aria-expanded={openFaqIndex === idx}
                className="flex w-full items-center justify-between gap-4 p-6 text-right outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                <span className="text-lg font-bold text-slate-800">
                  {faq.section && (
                    <span className="mb-1 block text-xs font-bold text-amber-600">{faq.section}</span>
                  )}
                  {faq.q}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openFaqIndex === idx ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden px-6 transition-all duration-300 ease-in-out ${
                  openFaqIndex === idx
                    ? 'max-h-96 pb-6 opacity-100'
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
          {text['support.channels.title']}
        </h2>

        <div className="grid items-start gap-8 md:grid-cols-3">
          <Card accentColor="amber" className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-800">واتساب</h3>
            <p className="mb-6 font-medium text-slate-500">
              {text['support.whatsapp.text']}
            </p>
            {/* ⚠️ كان زرار من غير رابط — مابيعملش حاجة. */}
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-green-600 px-6 font-bold text-white shadow-md hover:bg-green-700"
              >
                ابدأ المحادثة
              </a>
            ) : (
              <p className="text-sm font-bold text-slate-400">غير متاح حاليًا — استخدم التذكرة.</p>
            )}
          </Card>

          <Card accentColor="amber" className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-800">
              البريد الإلكتروني
            </h3>
            <p className="mb-6 font-medium text-slate-500">
              {text['support.email.text']}
            </p>
            <Button
              href={`mailto:${email}`}
              variant="secondary"
              accentColor="amber"
              className="w-full !border-0 !bg-slate-100 !text-slate-700 hover:!bg-slate-200"
            >
              <span dir="ltr" className="truncate">{email}</span>
            </Button>
          </Card>

          <Card accentColor="amber" className="p-8 md:col-span-1 md:row-span-2">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Ticket className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                {text['support.ticket.title']}
              </h3>
            </div>
            <p className="mb-6 text-sm font-medium text-slate-500">
              {text['support.ticket.text']}
            </p>

            <SupportTicketForm isSignedIn={isSignedIn} />
          </Card>
        </div>
      </Section>

      {/* Join Us Link */}
      <div className="mt-12 pb-16 w-full text-center">
        <p className="inline-flex items-center gap-2 text-lg font-medium text-slate-600">
          {text['support.join.text']}{' '}
          <Link
            href="/join-us"
            className="flex items-center gap-1 font-bold text-amber-600 hover:underline"
          >
            {text['support.join.link']} <ArrowLeft className="h-4 w-4" />
          </Link>
        </p>
      </div>
    </PageContainer>
  );
}
