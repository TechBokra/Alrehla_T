'use client';

import React, { useEffect, useState } from 'react';
import { ServiceCard, type ServiceCardData } from '@/components/creative-writing/ServiceCard';

/**
 * كروت الخدمات + فلتر التصنيف.
 *
 * ⚡ **الفلتر في المتصفح عن قصد.** كان `?category=` بيتقرا على الخادم، وده
 *    كان بيخلّي الصفحة كلها تتبني من الأول مع كل زيارة (~١ ثانية) بدل ما
 *    تتبعت جاهزة من Vercel (~٠٫١ ثانية). الكروت كلها جاية مع الصفحة، والفلتر
 *    بيخبّي ويظهّر بس — والرابط بالتصنيف لسه بيشتغل (`?category=` في العنوان).
 */
export function ServicesBrowser({ cards, categories }: { cards: ServiceCardData[]; categories: string[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('category');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- التصنيف من رابط المتصفح؛ مش متاح وقت بناء الصفحة على الخادم.
    if (c && categories.includes(c)) setActive(c);
  }, [categories]);

  const choose = (c: string | null) => {
    setActive(c);
    const url = new URL(window.location.href);
    if (c) url.searchParams.set('category', c);
    else url.searchParams.delete('category');
    window.history.replaceState(null, '', url.toString());
  };

  const shown = active ? cards.filter((c) => c.category === active) : cards;
  const chip = (label: string, value: string | null) => {
    const on = active === value;
    return (
      <button
        key={label}
        type="button"
        onClick={() => choose(value)}
        aria-pressed={on}
        className={`inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold transition-colors ${
          on ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      {categories.length > 1 && (
        <nav aria-label="تصنيفات الخدمات" className="mb-8 flex flex-wrap justify-center gap-2">
          {chip('الكل', null)}
          {categories.map((c) => chip(c, c))}
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white py-16 text-center font-bold text-slate-500">
          الخدمات بتتجهّز — ارجعلنا قريب.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((card) => (
            <ServiceCard key={card.id} service={card} />
          ))}
        </div>
      )}
    </>
  );
}
