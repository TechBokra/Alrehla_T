'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchFamilyMembers } from '@/app/actions/family';

/**
 * «بتكمّل طلب فلان» — حالة موافقة ولي الأمر على طلب ابنه.
 *
 * ── ليه مكوّن عميل ──────────────────────────────────────────
 *
 * ⚠️ **ده اللي خلّى صفحة الخدمة تتخزّن.**
 *
 *    الصفحة كانت بتقرا `?child=` و**أفراد العائلة من الخادم** عشان
 *    تكتب اسم الطفل. وأي صفحة بتقرا رابطها أو مستخدمها بتتبني لكل
 *    زيارة. بالقياس على المنشور: ٩٠٥ مللي للزيارة، مقابل ١٢٠ للصفحة
 *    المتخزّنة.
 *
 *    والحالة دي **بتحصل في زيارة من كل كمية كبيرة** — ولي أمر جاي
 *    من إشعار طلب ابنه. فكل الزوّار كانوا بيدفعوا تمن حالة قليلة.
 *
 *    دلوقتي الصفحة متخزّنة للكل، والشريط ده بيظهر في المتصفح لما
 *    الرابط يكون فيه `?child=` — ومافيش `?child=` يعني مفيش نداء
 *    خالص (الشرط أول سطر).
 */
function GuardianPresetInner() {
  const params = useSearchParams();
  const childId = params.get('child');
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    // مفيش `child` في الرابط = مفيش شغل. الحالة الغالبة.
    if (!childId) return;
    let alive = true;
    fetchFamilyMembers()
      .then((family) => {
        if (!alive) return;
        const child = family.find((c) => c.id === childId);
        setName(child?.fullName ?? null);
      })
      // ⚠️ الفشل = مفيش شريط. الشريط ده **تأكيد** مش حارس: لو
      //    مابانش، ولي الأمر لسه بيكمّل الطلب عادي والمستفيد محدّد
      //    في الرابط. فرسالة خطأ هنا تقلق بلا داعي.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [childId]);

  if (!childId || !name) return null;

  return (
    <div className="rounded-card mb-6 border border-amber-200 bg-amber-50 p-4">
      <p className="font-bold text-amber-900">بتكمّل طلب {name}</p>
      <p className="mt-1 text-sm font-medium text-amber-800">
        كمّل الطلب من هنا، والخدمة بتتسجّل باسمه.
      </p>
    </div>
  );
}

/**
 * «اختيار فلان» جنب مقدّم الخدمة اللي الطفل اختاره.
 *
 * ⚠️ كانت بتتحسب على الخادم من `?provider=`، وقراءة الرابط على
 *    الخادم بتمنع تخزين الصفحة — زيّ `?child=` بالظبط.
 */
/**
 * ⚠️ **الأغلفة دي إلزامية مش احتياط.** `useSearchParams` جوّه صفحة
 *    متخزّنة **بيفشّل البناء** من غير `Suspense` — Next بيطلب الحدّ
 *    ده صريحًا. والبديل إن الصفحة ترجع تتبني لكل زيارة، وده اللي
 *    إحنا خارجين منه.
 */
export function GuardianPreset() {
  return (
    <Suspense fallback={null}>
      <GuardianPresetInner />
    </Suspense>
  );
}

function ChildChoiceTagInner({ providerId }: { providerId: string }) {
  const params = useSearchParams();
  const childId = params.get('child');
  const chosen = params.get('provider');
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!childId || chosen !== providerId) return;
    let alive = true;
    fetchFamilyMembers()
      .then((family) => {
        if (alive) setName(family.find((c) => c.id === childId)?.fullName ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [childId, chosen, providerId]);

  if (!name) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
      اختيار {name}
    </span>
  );
}

export function ChildChoiceTag({ providerId }: { providerId: string }) {
  return (
    <Suspense fallback={null}>
      <ChildChoiceTagInner providerId={providerId} />
    </Suspense>
  );
}

/**
 * زرار الطلب — بيحتفظ بـ`?child=` اللي في الرابط الحالي.
 *
 * ⚠️ **الصفحة مابتقراش الرابط على الخادم** (ده اللي كان بيمنع
 *    التخزين)، فتمرير `child` لصفحة الطلب بيحصل في المتصفح.
 *
 * ⚠️ **ومن غير `child` الرابط زيّ ما هو بالظبط** — يعني الزائر
 *    العادي مابيتغيّرش عنده حاجة.
 */
export function OrderLink(props: { href: string; className?: string; children: React.ReactNode }) {
  return (
    // ⚠️ الاحتياطي هنا **الرابط العادي**، مش `null`: زرار الطلب
    //    لازم يبان ويشتغل من أول لحظة؛ إضافة `?child=` تحسين فوقه.
    <Suspense
      fallback={
        <Link href={props.href} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <OrderLinkInner {...props} />
    </Suspense>
  );
}

function OrderLinkInner({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const childId = useSearchParams().get('child');
  const target = childId
    ? `${href}${href.includes('?') ? '&' : '?'}child=${encodeURIComponent(childId)}`
    : href;
  return (
    <Link href={target} className={className}>
      {children}
    </Link>
  );
}
