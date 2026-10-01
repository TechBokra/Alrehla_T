import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { describeBoxDetails } from '@/lib/order-customization';
import { formatPrice } from '@/lib/utils';
import { OrderItemCustomization } from './OrderItemCustomization';

/**
 * طلب اشتراك صندوق الرحلة (ملف 140): الخطة وقت الشراء + هدف كل شهر +
 * بيانات الطفل وصوره.
 *
 * ⚠️ الطلب ده **مالوش بنود** — الاشتراك مش منتج. والتنفيذ مش من هنا:
 *    بعد تأكيد الدفع القاعدة بتعمل الاشتراك وشهوره لوحدها، والشحن
 *    بيتتابع شهر شهر من صفحة الاشتراك.
 */
export function BoxOrderPanel({
  details,
  subscriptionId,
  paid,
}: {
  details: unknown;
  subscriptionId?: string;
  paid: boolean;
}) {
  const box = describeBoxDetails(details);
  if (!box) return null;

  return (
    <div className="mb-8 space-y-4">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
          <PackageOpen className="h-5 w-5" aria-hidden /> اشتراك صندوق الرحلة — {box.planName}
        </h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline font-bold text-slate-700">المدة: </dt>
            <dd className="inline">{box.months.toLocaleString('ar-EG')} شهور</dd>
          </div>
          {box.price != null && (
            <div>
              <dt className="inline font-bold text-slate-700">سعر الخطة: </dt>
              <dd className="inline">{formatPrice(box.price)}</dd>
            </div>
          )}
          {box.shippingPerMonth != null && (
            <div>
              <dt className="inline font-bold text-slate-700">الشحن: </dt>
              <dd className="inline">
                {formatPrice(box.shippingPerMonth)} × {box.months.toLocaleString('ar-EG')}
              </dd>
            </div>
          )}
          <div>
            <dt className="inline font-bold text-slate-700">الإضافة المجانية: </dt>
            <dd className="inline">{box.freeAddonName ?? '—'}</dd>
          </div>
          {box.addonDiscountPercent > 0 && (
            <div>
              <dt className="inline font-bold text-slate-700">خصم المشترك: </dt>
              <dd className="inline">{box.addonDiscountPercent.toLocaleString('ar-EG')}٪ على الإضافات</dd>
            </div>
          )}
        </dl>

        <h4 className="mt-4 mb-2 text-sm font-bold text-slate-800">هدف قصة كل شهر</h4>
        <ol className="space-y-1 text-sm">
          {box.goals.map((g, i) => (
            <li key={i}>
              <span className="font-bold">الشهر {(i + 1).toLocaleString('ar-EG')}:</span>{' '}
              {g ?? <span className="text-slate-600">تختاره الإدارة</span>}
            </li>
          ))}
        </ol>

        <p className="mt-4 text-sm font-bold">
          {subscriptionId ? (
            <Link href={`/dashboard/admin/subscriptions/box/${subscriptionId}`} className="text-blue-700 hover:underline">
              فتح الاشتراك ومتابعة شحنات الشهور ←
            </Link>
          ) : paid ? (
            <span className="text-red-700">
              الدفع متأكد والاشتراك مااتعملش — راجع إن ملف 140 اتشغّل.
            </span>
          ) : (
            <span className="text-slate-700">الاشتراك بيتعمل لوحده أول ما تأكد الدفع.</span>
          )}
        </p>
      </div>

      <OrderItemCustomization productName={box.planName} customization={details} />
    </div>
  );
}
