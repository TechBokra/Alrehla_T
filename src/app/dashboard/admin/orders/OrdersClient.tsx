'use client';
import { formatDate, formatPrice } from '@/lib/utils';
import React, { useState } from 'react';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { Order } from '@/types';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { PRODUCT_ORDER_STATUS, productOrderStatus } from '@/lib/order-status';

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
 */
export function OrdersClient({
  initialOrders,
  productNames,
}: {
  initialOrders: Order[];
  /** رقم المنتج ← اسمه. */
  productNames: Record<string, string>;
}) {
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = initialOrders.filter((order) =>
    statusFilter ? order.status === statusFilter : true,
  );

  const itemsLine = (order: Order) => {
    // طلب صندوق الرحلة مالوش منتج في الجدول — اسم الخطة محفوظ في الطلب.
    const plan = (order.boxDetails as { plan?: { name?: unknown } } | undefined)?.plan?.name;
    if (order.boxPlanId) return [`صندوق الرحلة${typeof plan === 'string' ? ` — ${plan}` : ''}`];
    return order.items.map((item) => {
      const name = productNames[item.productId] ?? 'منتج محذوف';
      const child = (item.customizationData as { childName?: unknown } | undefined)?.childName;
      const qty = item.quantity > 1 ? ` ×${item.quantity}` : '';
      return typeof child === 'string' && child.trim() ? `${name} — لـ${child.trim()}${qty}` : `${name}${qty}`;
    });
  };

  const formatted = filtered.map((order) => {
    const view = productOrderStatus(order.status);
    const lines = itemsLine(order);
    return {
      ...order,
      idDisplay: (
        <Link href={`/dashboard/admin/orders/${order.id}`} className="font-bold text-blue-600 hover:underline">
          #{order.paymentReference || order.id.split('-')[1]}
        </Link>
      ),
      itemsDisplay: (
        <ul className="space-y-0.5 text-sm font-medium text-slate-700">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ),
      // للبحث في الجدول — اسم المنتج واسم الطفل.
      itemsText: lines.join(' · '),
      dateDisplay: formatDate(order.createdAt),
      amountDisplay: `${formatPrice(order.totalAmount)}`,
      statusDisplay: <StatusBadge type={view.type} label={view.label} />,
    };
  });

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
    { header: 'المنتجات', accessorKey: 'itemsDisplay' },
    { header: 'التاريخ', accessorKey: 'dateDisplay' },
    { header: 'المبلغ الإجمالي', accessorKey: 'amountDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
  ];

  return (
    <div>
      <div className="mb-6 flex">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">جميع الحالات</option>
          {Object.entries(PRODUCT_ORDER_STATUS).map(([value, v]) => (
            <option key={value} value={value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
