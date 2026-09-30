import { getMyTickets } from '@/data/domains/account';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';

export default async function SupportPage() {
  const tickets = await getMyTickets();
  
  const formatted = tickets.map(ticket => ({
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    date: formatDate(ticket.createdAt),
    statusDisplay: <StatusBadge type={ticket.status === 'open' ? 'warning' : ticket.status === 'answered' ? 'success' : 'neutral'} label={ticket.status} />
  }));

  const columns = [
    { header: 'الموضوع', accessorKey: 'subject' },
    { header: 'القسم', accessorKey: 'category' },
    { header: 'التاريخ', accessorKey: 'date' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-blue-900 mb-1">هل تواجه مشكلة في حجز جلسة؟</h2>
          <p className="text-blue-700 text-sm">إذا كنت بحاجة للمساعدة في اختيار مدرب أو باقة، فريقنا جاهز لدعمك.</p>
        </div>
        <Link 
          href="/account/support/session-request"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <HelpCircle className="h-5 w-5" />
          طلب مساعدة في الحجز
        </Link>
      </div>

      <DashboardPageHeader title="تذاكر الدعم" action={{ label: 'تذكرة جديدة', href: '#' }} />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
