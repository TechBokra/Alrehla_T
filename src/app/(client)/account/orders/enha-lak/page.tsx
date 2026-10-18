import Link from 'next/link';
import { BookOpenCheck } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { productOrderStatus } from '@/lib/order-status';
import { countAwaitingPreviews } from '@/data/domains/(client)/story-preview/queries';
import { getOrders } from '@/data/domains/(client)/orders/queries';
import { getPersonalizedProducts } from '@/data/domains/(client)/products/queries';
import { getProductNamesFor } from '@/data/domains/(shared)/products/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { OrderLinesList } from '@/components/orders/OrderLinesList';
import { orderLines } from '@/lib/order-lines';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { PendingOrderActions } from '@/components/orders/PendingOrderActions';
import { getPaymentAvailability } from '@/data/domains/(shared)/payments/queries';

export const dynamic = 'force-dynamic';

/* ⚠️ **كانت فيه خريطة حالات تالتة هنا.**

   `order-status.ts` اتكتب عشان يبقى «مصدر واحد للاسم واللون»،
   وفيه بالحرف إن `preparing` بقى `info` مش `warning` لأن
   «التحذير معناه فيه حاجة غلط» — ولو التقدّم الطبيعي برتقالي،
   العين بتتعلّم تتجاهل البرتقالي، **وساعتها بتتجاهل الطلب اللي
   فيه مشكلة حقيقية**.

   والنسخة اللي كانت هنا كانت لسه بتقول `preparing: warning` —
   يعني نفس العطل اللي الملف ده اتكتب يقفله، في الشاشة اللي
   العميل بيشوفها. اتشالت، والخريطة بقت من المصدر الواحد. */


export default async function EnhaLakOrdersPage() {
  const [allOrders, products, settings, payment] = await Promise.all([
    getOrders(),
    getPersonalizedProducts(),
    getSiteSettings(),
    // نص زرار الدفع بيختلف: بوابة = «أكمل الدفع»، تحويل = «ادفع وارفع الإيصال».
    getPaymentAvailability(),
  ]);
  const cancelDays = settings.pendingOrderCancelDays;

  /* ⚠️ **الطلبات اللي لسه بتتجهّز وبس.** عدّ المعاينات بيناديها
     القاعدة لكل طلب، والعميل عنده طلبات مقفولة من شهور — فالطلب
     الملغي والمسلّم والمستني دفع مفيش فيهم نص مستني قرار، وسؤال
     القاعدة عنهم شغل زيادة على كل زيارة بلا نتيجة. */
  const liveOrders = allOrders.filter((o) => o.status === 'paid' || o.status === 'preparing');
  const awaitingByOrder: Record<string, number> = Object.fromEntries(
    await Promise.all(
      liveOrders.map(async (o) => [o.id, await countAwaitingPreviews(o.id)] as const),
    ),
  );
  const names: Record<string, string> = Object.fromEntries(products.map((p) => [p.id, p.name]));
  // المنتجات اللي اتخفت بعد ما العميل طلبها — اسمها بيفضل ظاهر في طلباته (4.4).
  const missing = allOrders.flatMap((o) => o.items.map((i) => i.productId)).filter((id) => id && !names[id]);
  Object.assign(names, await getProductNamesFor(missing));
  const orders = allOrders.map(order => ({
    // ⚠️ الرقم المرجعي، مش رقم الصف: هو اللي العميل كتبه في ملاحظة التحويل،
    //    وهو اللي بيظهر للإدارة — فلو كلّم الدعم، الرقم واحد في الشاشتين.
    idDisplay: (
      <span dir="ltr" className="font-mono font-bold">
        {order.paymentReference ?? order.id.replace('ord-', '').toUpperCase()}
      </span>
    ),
    date: new Date(order.createdAt).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE }),
    statusDisplay: (
      <div className="flex flex-col items-start gap-2">
        <StatusBadge {...productOrderStatus(order.status)} />

        {/* ══ معاينة مستنية موافقته ═══════════════════════════
            ⚠️ **ودي أهم سطر في الشاشة.** الطلب بيقول «قيد
               التجهيز» وهو في الحقيقة واقف مستني **هو**. من
               غير السطر ده، ولي الأمر بيستنى وإحنا مستنيين،
               والشغل واقف والفلوس مدفوعة.

               وبنعرضه فوق الحالة عشان يبان قبلها، ومش بنغيّر
               الحالة نفسها: الحالة بتوصف فين الطلب في الشغل،
               والسطر ده بيوصف المطلوب منه. */}
        {(awaitingByOrder[order.id] ?? 0) > 0 && (
          <Link
            href={`/account/orders/enha-lak/${order.id}/preview`}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 font-black text-amber-900 transition-colors hover:bg-amber-100"
          >
            <BookOpenCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            النص جاهز — اقراه ووافق
          </Link>
        )}
        {/* الطلب اتسجّل والدفع ما كملش — يكمّله أو يلغيه بنفسه.
            `failed` كمان: محاولة دفع رجعت بالفشل، والطلب لسه قابل للدفع. */}
        {(order.status === 'pending' || order.status === 'failed') && (
          <PendingOrderActions
            orderId={order.id}
            payHref={`/account/orders/enha-lak/${order.id}/pay`}
            gateway={payment.mode === 'gateway'}
          />
        )}
        {order.status === 'pending' && cancelDays > 0 && (
          <span className="text-xs text-slate-600">
            بيتلغي تلقائيًا لو مااتدفعش خلال {cancelDays} أيام من تاريخ الطلب
          </span>
        )}
      </div>
    ),
    // الإلكتروني مالوش رقم شحنة — بيتقال اتبعت ولا لسه (ملف 138).
    tracking: (
      <div className="flex flex-col gap-1">
        <span>{order.trackingReference || '—'}</span>
        {order.deliveryEmail && (
          <span className="text-xs font-bold text-slate-700">
            {order.electronicSentAt ? 'النسخة الإلكترونية اتبعتت ✓' : 'النسخة الإلكترونية: لسه'}
          </span>
        )}
      </div>
    ),
    // ⭐ كود الخصم وقيمته ظاهرين للعميل نفسه (طلب تامر).
    total: (
      <div className="flex flex-col gap-0.5">
        <span className="font-bold">{formatPrice(order.totalAmount)}</span>
        {order.discountCode && (
          <span className="text-xs font-bold text-emerald-800">
            شامل خصم <span dir="ltr" className="font-mono">{order.discountCode}</span> (− {formatPrice(order.discountAmount ?? 0)})
          </span>
        )}
        {!!order.shippingFee && <span className="text-xs text-slate-600">منها شحن {formatPrice(order.shippingFee)}</span>}
      </div>
    ),
    itemsDisplay: (
      <div className="flex flex-col gap-1">
        {/* طلب اشتراك (ملف 140): مالوش بنود — الشحنات في صفحة الاشتراك. */}
        {order.boxPlanId && (
          <span>
            اشتراك صندوق الرحلة
            {typeof (order.boxDetails?.plan as { name?: unknown } | undefined)?.name === 'string' &&
              ` — ${(order.boxDetails?.plan as { name: string }).name}`}
            {' · '}
            <a href="/account/subscriptions/box" className="font-bold text-rose-700 hover:underline">الشحنات</a>
          </span>
        )}
        {/* كان بيعرض رقم المنتج الداخلي («منتج (3f2a…)») بدل اسمه. ودلوقتي
            كل بند بنسخته ولمين **وإضافاته بأسعارها** (طلب تامر). */}
        <OrderLinesList lines={orderLines(order, names)} />
      </div>
    ),
  }));

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
    { header: 'التاريخ', accessorKey: 'date' },
    { header: 'الإجمالي', accessorKey: 'total' },
    { header: 'المنتجات', accessorKey: 'itemsDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
    { header: 'رقم الشحنة', accessorKey: 'tracking' }
  ];

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="المنتجات والاشتراكات" />
      <p className="mt-2 text-slate-500 font-medium">سجل طلباتك من معرض وقصص إنها لك.</p>
      <SimpleDataTable columns={columns} data={orders} />
    </div>
  );
}
