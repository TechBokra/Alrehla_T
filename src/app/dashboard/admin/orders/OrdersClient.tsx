'use client';
import { formatDate , formatPrice } from '@/lib/utils';
import React, { useState } from 'react';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { Order } from '@/types';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';

export function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = initialOrders.filter(order => {
    return statusFilter ? order.status === statusFilter : true;
  });

  const formatted = filtered.map(order => {
    return {
      ...order,
      idDisplay: (
        <Link href={`/dashboard/admin/orders/${order.id}`} className="font-bold text-blue-600 hover:underline">
          #{order.id.split('-')[1]}
        </Link>
      ),
      dateDisplay: formatDate(order.createdAt),
      amountDisplay: `${formatPrice(order.totalAmount)}`,
      statusDisplay: (
        <StatusBadge
          type={order.status === 'paid' ? 'success' : order.status === 'failed' ? 'danger' : order.status === 'refunded' ? 'neutral' : order.status === 'awaiting_verification' ? 'warning' : 'warning'}
          label={order.status === 'paid' ? 'مدفوع' : order.status === 'failed' ? 'فشل الدفع' : order.status === 'refunded' ? 'مسترجع' : order.status === 'awaiting_verification' ? 'بانتظار تأكيد الدفع' : 'قيد الانتظار'}
        />
      )
    };
  });

  const columns = [
    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
    { header: 'التاريخ', accessorKey: 'dateDisplay' },
    { header: 'المبلغ الإجمالي', accessorKey: 'amountDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
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
          <option value="pending">قيد الانتظار</option>
          <option value="awaiting_verification">بانتظار تأكيد الدفع</option>
          <option value="paid">مدفوع</option>
          <option value="failed">فشل الدفع</option>
          <option value="refunded">مسترجع</option>
        </select>
      </div>
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
