import React from 'react';
import { KidsDoodles } from '@/components/enha-lak/KidsDoodles';

/**
 * رأس صفحات «إنها لك» — **واحد لـ«أنت البطل هنا» و«المكتبة العامة»**.
 *
 * كان كل صفحة بتستعمل `SectionHeader` العام (نفس رأس المدونة والدعم)
 * — فالقسم اللي بيبيع لأطفال كان شكله زي صفحة الشروط والأحكام. الطلب:
 * «يبقى طفولي أكتر».
 *
 * ⚠️ **الطفولي في الزينة لا في القراءة**: العنوان بخط مرح (`font-kids`)
 *    والخلفية فيها رسومات — لكن الوصف بالخط العادي وبحجمه، لأن اللي
 *    بيقرا ويقرّر ويدفع **ولي الأمر** مش الطفل.
 *
 * ⚠️ و`h1` واحد في الصفحة — نفس اللي كان في `SectionHeader`.
 */
export function ShelfHeader({
  title,
  description,
  icon,
  eyebrow,
}: {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  /** سطر صغير فوق العنوان — مثلًا «قصة جاهزة… وغلاف باسم طفلك». */
  eyebrow?: string;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-4 md:px-8">
      <div className="relative overflow-hidden rounded-[2rem] border-2 border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 px-6 py-10 text-center shadow-sm md:px-12 md:py-14">
        <KidsDoodles />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-md ring-4 ring-rose-100">
            {icon}
          </div>
          {eyebrow && (
            <p className="mb-2 text-sm font-bold text-rose-700">{eyebrow}</p>
          )}
          <h1 className="font-kids text-4xl leading-tight font-extrabold text-slate-900 md:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed font-medium text-slate-600 md:text-lg">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
