'use client';
import { formatDate, formatPrice } from '@/lib/utils';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import type { Order } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { PRODUCT_ORDER_STATUS, productOrderStatus } from '@/lib/order-status';
import { Field, Select, TextInput, Checkbox } from '@/components/forms/Form';
import { OrderLinesList } from '@/components/orders/OrderLinesList';
import {
  ORDER_KIND_LABELS,
  boxPlanName,
  orderKind,
  orderLines,
  orderSearchText,
  type OrderKind,
} from '@/lib/order-lines';

/**
 * قايمة طلبات المنتجات.
 *
 * ⚠️ **كانت رقم طلب وتاريخ ومبلغ بس** — مفيش ولا كلمة عن المنتج. فطلب
 *    «قصة مخصصة لليلى» وطلب «كتاب من المكتبة» شكلهم واحد، والإدارة لازم
 *    تفتح كل طلب عشان تعرف فيه إيه. دلوقتي عمود «المنتجات» بأسمائها، ولمين
 *    التخصيص. (ملاحظة تامر: «طلبات التخصيص مرتبطة باسم المنتج».)
 *
 * ⚠️ **والحالة كانت شرط بخمس حالات بس** — «قيد التجهيز» و«تم الشحن» و«تم
 *    التسليم» و«ملغي» كانوا بيطلعوا «قيد الانتظار». دلوقتي من نفس خريطة
 *    الحالات اللي صفحة الطلب بتستعملها (`lib/order-status`).
 *
 * ⭐ (طلب تامر) **فلترة بالنوع** — «أنت البطل» / المكتبة / الصندوق — عشان
 *    كل مسؤول يتابع نوعه، **والإضافات والنسخة وكود الخصم ظاهرين في الصف**
 *    من غير ما يفتح الطلب. و«محتاج إجراء» = الحالات اللي مستنية حد يعمل
 *    حاجة (مراجعة دفع، تجهيز، شحن).
 */

/** الحالات اللي مستنية حد من الإدارة. */
const NEEDS_ACTION = new Set(['awaiting_verification', 'paid', 'preparing', 'shipped']);

type KindFilter = OrderKind | 'all';

export function OrdersClient({
  initialOrders,
  productNames,
  productCategories = {},
  customerNames = {},
}: {
  initialOrders: Order[];
  /** رقم المنتج ← اسمه. */
  productNames: Record<string, string>;
  /** رقم المنتج ← نوعه (`custom` / `library`). */
  productCategories?: Record<string, string>;
  /** رقم الحساب ← اسم العميل. */
  customerNames?: Record<string, string>;
}) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [discountFilter, setDiscountFilter] = useState<'' | 'with' | 'without'>('');
  const [electronicOnly, setElectronicOnly] = useState(false);
  const [query, setQuery] = useState('');

  // كل طلب بيتحسب مرة واحدة: النوع والبنود ونص البحث.
  const rows = useMemo(
    () =>
      initialOrders.map((order) => {
        const lines = orderLines(order, productNames, productCategories);
        const customer = customerNames[order.userId];
        return {
          order,
          lines,
          kind: orderKind(order, productCategories),
          customer,
          search: orderSearchText(lines, [
            order.paymentReference,
            customer,
            order.recipientName,
            order.recipientPhone,
            order.discountCode,
            boxPlanName(order),
          ]),
        };
      }),
    [initialOrders, productNames, productCategories, customerNames],
  );

  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = { all: rows.length, custom: 0, library: 0, box: 0, mixed: 0 };
    for (const r of rows) c[r.kind] += 1;
    return c;
  }, [rows]);

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (kind !== 'all' && r.kind !== kind) return false;
    if (statusFilter === 'needs_action') {
      if (!NEEDS_ACTION.has(r.order.status)) return false;
    } else if (statusFilter && r.order.status !== statusFilter) return false;
    if (discountFilter === 'with' && !r.order.discountCode) return false;
    if (discountFilter === 'without' && r.order.discountCode) return false;
    if (electronicOnly && !r.order.items.some((i) => i.format && i.format !== 'printed')) return false;
    if (q && !r.search.includes(q)) return false;
    return true;
  });

  const formatted = filtered.map(({ order, lines, customer }) => {
    const view = productOrderStatus(order.status);
    const plan = boxPlanName(order);
    return {
      id: order.id,
      idDisplay: (
        <div className="flex flex-col gap-0.5">
          <Link href={`/dashboard/admin/orders/${order.id}`} className="font-bold text-blue-600 hover:underline">
            <span dir="ltr" className="font-mono">#{order.paymentReference || order.id.split('-')[1]}</span>
          </Link>
          <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
        </div>
      ),
      customerDisplay: (
        <div className="flex flex-col text-sm">
          <span className="font-bold text-slate-800">{customer || order.recipientName || '—'}</span>
          {order.recipientPhone && (
            <span dir="ltr" className="text-right text-xs text-slate-500">
              {order.recipientPhone}
            </span>
          )}
        </div>
      ),
      itemsDisplay: order.boxPlanId ? (
        <span className="text-sm font-bold text-slate-800">صندوق الرحلة{plan ? ` — ${plan}` : ''}</span>
      ) : (
        <OrderLinesList lines={lines} compact />
      ),
      discountDisplay: order.discountCode ? (
        <div className="flex flex-col text-xs">
          <span dir="ltr" className="font-mono font-bold text-emerald-800">{order.discountCode}</span>
          <span className="font-bold text-emerald-700">− {formatPrice(order.discountAmount ?? 0)}</span>
        </div>
      ) : (
        <span className="text-slate-400">—</span>
      ),
      amountDisplay: formatPrice(order.totalAmount),
      statusDisplay: <StatusBadge type={view.type} label={view.label} />,
    };
  });

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
    { header: 'العميل', accessorKey: 'customerDisplay' },
    { header: 'المنتجات والإضافات', accessorKey: 'itemsDisplay' },
    { header: 'كود الخصم', accessorKey: 'discountDisplay' },
    { header: 'الإجمالي', accessorKey: 'amountDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
  ];

  const chip = (active: boolean) =>
    'inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ' +
    (active
      ? 'border-slate-900 bg-slate-900 text-white'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400');

  const kinds: KindFilter[] = ['all', 'custom', 'library', 'box', ...(counts.mixed ? (['mixed'] as const) : [])];

  return (
    <div className="space-y-6">
      <nav aria-label="نوع الطلب" className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={chip(kind === k)} aria-pressed={kind === k}>
            {k === 'all' ? 'كل الطلبات' : ORDER_KIND_LABELS[k]}
            <span className={`rounded-full px-2 text-xs ${kind === k ? 'bg-white/20' : 'bg-slate-100'}`}>
              {counts[k].toLocaleString('ar-EG')}
            </span>
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <Field label="بحث" hint="رقم الطلب، العميل، التليفون، المنتج، الطفل، الإضافة، الكود">
          <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <Field label="الحالة">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">كل الحالات</option>
            <option value="needs_action">محتاج إجراء (دفع / تجهيز / شحن)</option>
            {Object.entries(PRODUCT_ORDER_STATUS).map(([value, v]) => (
              <option key={value} value={value}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="كود الخصم">
          <Select value={discountFilter} onChange={(e) => setDiscountFilter(e.target.value as typeof discountFilter)}>
            <option value="">الكل</option>
            <option value="with">بكود خصم</option>
            <option value="without">من غير كود</option>
          </Select>
        </Field>
        <div className="flex items-end pb-3">
          <Checkbox
            label="فيه نسخة إلكترونية"
            checked={electronicOnly}
            onChange={(e) => setElectronicOnly(e.target.checked)}
          />
        </div>
      </div>

      <p aria-live="polite" className="text-sm font-bold text-slate-600">
        {filtered.length === rows.length
          ? `${rows.length.toLocaleString('ar-EG')} طلب`
          : `${filtered.length.toLocaleString('ar-EG')} من ${rows.length.toLocaleString('ar-EG')} طلب`}
      </p>

      <SimpleDataTable columns={columns} data={formatted} enableSearch={false} emptyMessage="مفيش طلبات بالفلاتر دي." />
    </div>
  );
}
