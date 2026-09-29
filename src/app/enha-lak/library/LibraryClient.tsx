'use client';

import React, { useState, useMemo } from 'react';
import { Book, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { ProductCard } from '@/components/enha-lak/ProductCard';
import {
  filterProducts,
  sortProducts,
  resultLabel,
  hasActiveFilter,
  PRODUCT_SORTS,
  type ProductSort,
} from '@/lib/product-display';
import type { PersonalizedProduct, Publisher } from '@/types';

/**
 * شبكة المكتبة بفلاترها.
 *
 * ── تلات أعطال اتصلحت هنا ───────────────────────────────────
 *
 * 🔴 **فلتر «مطبوع فقط» مكانش بيعمل حاجة.** الشرط بتاعه كان فرعًا
 *    فاضيًا فيه تعليق «لو كان عندنا حقل للمطبوع كنا هنفلتر». يعني
 *    العميل بيختاره والقايمة مابتتغيّرش — **الزرّ الصامت** اللي
 *    وقعنا فيه تلات مرات قبل كده. اتشال هو وفلتر النوع كله، لأن
 *    نصّه التاني (إلكتروني) بيفلتر بسعر مش قابل للشراء أصلًا.
 *
 * 🔴 **«الأحدث» كانت بترتّب بالرقم.** رقم المنتج `uuid` عشوائي،
 *    فالترتيب كان عشوائيًّا وثابتًا. بقى بالتاريخ الحقيقي.
 *
 * 🔴 **«لا توجد نتائج — جرّب تغيير كلمات البحث»** كانت بتظهر حتى
 *    لما الرفّ فاضي أصلًا. الجملة دي بتقول للعميل إنه غلطان وهو
 *    مش غلطان.
 */
export function LibraryClient({
  initialProducts,
  publishers,
}: {
  initialProducts: PersonalizedProduct[];
  publishers: Publisher[];
}) {
  const [query, setQuery] = useState('');
  const [publisherId, setPublisherId] = useState('all');
  const [sort, setSort] = useState<ProductSort>('newest');

  const visible = useMemo(
    () => sortProducts(filterProducts(initialProducts, { query, publisherId }), sort),
    [initialProducts, query, publisherId, sort],
  );

  const filtering = hasActiveFilter({ query, publisherId });
  const count = resultLabel(visible.length, initialProducts.length);

  const clear = () => {
    setQuery('');
    setPublisherId('all');
  };

  // ⚠️ دور النشر اللي مالهاش كتاب في المكتبة **مابتظهرش في القايمة**:
  //    اختيارها بيدّي صفر نتايج دايمًا، والعميل بيفتكر إن الموقع باظ.
  const usablePublishers = publishers.filter((pub) =>
    initialProducts.some((p) => p.publisherId === pub.id),
  );

  return (
    <Section containerClassName="max-w-7xl">
      <Card accentColor="rose" className="mb-6 p-4 shadow-sm lg:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
              <Search className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="search"
              placeholder="ابحث باسم الكتاب أو بكلمة من وصفه…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pr-12 pl-4 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-4 md:flex-nowrap">
            {usablePublishers.length > 0 && (
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="hidden h-5 w-5 text-slate-500 sm:block" />
                <select
                  aria-label="دار النشر"
                  className="min-w-[160px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                  value={publisherId}
                  onChange={(e) => setPublisherId(e.target.value)}
                >
                  <option value="all">جميع دور النشر</option>
                  {usablePublishers.map((pub) => (
                    <option key={pub.id} value={pub.id}>
                      {pub.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <ArrowUpDown className="hidden h-5 w-5 text-slate-500 sm:block" />
              <select
                aria-label="الترتيب"
                className="min-w-[180px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                value={sort}
                onChange={(e) => setSort(e.target.value as ProductSort)}
              >
                {PRODUCT_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* ⚠️ العدد مش زينة: من غيره العميل اللي فلتر مايعرفش هو بيبصّ
          على الكل ولا على جزء، ولا إن الفلتر قصّ النتايج. */}
      {count && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p aria-live="polite" className="text-sm font-bold text-slate-600">
            {count}
          </p>
          {filtering && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition-colors hover:border-slate-400"
            >
              <X className="h-3.5 w-3.5" />
              امسح الفلاتر
            </button>
          )}
        </div>
      )}

      {visible.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              publisherName={publishers.find((p) => p.id === product.publisherId)?.name}
              cardHref={`/enha-lak/product/${product.slug}`}
              actionLabel="تخصيص الغلاف"
              actionHref={`/enha-lak/custom-library/${product.slug}`}
            />
          ))}
        </div>
      ) : (
        <Card
          accentColor="rose"
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <Book className="mb-4 h-16 w-16 text-slate-300" />
          {/* ⚠️ رسالتان لا واحدة. «جرّب تغيير كلمات البحث» على رفّ
              فاضي بتقول للعميل إنه غلطان وهو مش غلطان. */}
          {filtering ? (
            <>
              <h3 className="mb-2 text-2xl font-black text-slate-800">مفيش نتايج</h3>
              <p className="mb-6 font-medium text-slate-600">
                جرّب كلمة تانية أو شيل الفلاتر.
              </p>
              <button
                type="button"
                onClick={clear}
                className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800"
              >
                اعرض كل الكتب
              </button>
            </>
          ) : (
            <>
              <h3 className="mb-2 text-2xl font-black text-slate-800">
                المكتبة لسه بتتجهّز
              </h3>
              <p className="font-medium text-slate-600">
                بنضيف إصدارات دور النشر أول بأول — ارجع لنا قريب.
              </p>
            </>
          )}
        </Card>
      )}
    </Section>
  );
}
