import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getMessagesForTicket } from '@/data/domains/account';
import { getAllSupportTickets } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { Paperclip, Send, CheckCircle, Clock, Archive } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { TicketReplyBox, CloseTicketButton } from './TicketActions';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSupport')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const tickets = await getAllSupportTickets();
  const target = tickets.find(t => t.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  
  const messages = await getMessagesForTicket(target.id);
  
  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-5xl flex-col px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 border-b border-slate-200 pb-6 gap-4">
        <div>
          <DashboardPageHeader title={`تذكرة #${target.id.split('-')[1]}`} backHref="/dashboard/admin/support/tickets" />
          <h2 className="text-xl font-bold text-slate-700 mt-2">{target.subject}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
            <span>المرسل: {target.requesterName}</span>
            <span>•</span>
            <span>{formatDate(target.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 items-end">
          <StatusBadge 
            type={target.status === 'open' ? 'warning' : target.status === 'answered' ? 'success' : 'neutral'}
            label={target.status === 'open' ? 'مفتوحة (تحتاج لرد)' : target.status === 'answered' ? 'تم الرد' : 'مغلقة'}
          />
          {target.status !== 'closed' && (
            <CloseTicketButton ticketId={target.id} />
          )}
        </div>
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {messages.map((msg) => {
            const isAdmin = msg.senderName === 'الدعم الفني';
            return (
              <div key={msg.id} className={`flex gap-4 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold shadow-sm ${isAdmin ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  {msg.senderName?.[0] || 'U'}
                </div>
                <div className={`flex flex-col gap-1 max-w-[80%] ${isAdmin ? 'items-end' : ''}`}>
                  <span className="text-sm font-bold text-slate-500 mx-1">{msg.senderName} {isAdmin && '(أنت)'}</span>
                  <div className={`rounded-3xl p-5 shadow-sm text-[15px] leading-relaxed ${isAdmin ? 'rounded-tl-none bg-amber-500 text-white' : 'rounded-tr-none bg-white text-slate-700 border border-slate-100'}`}>
                    {msg.message}
                  </div>
                  <span className="text-xs font-medium text-slate-400 mx-1 flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Reply Input */}
        {target.status !== 'closed' ? (
          <TicketReplyBox ticketId={target.id} />
        ) : (
          <div className="border-t border-slate-100 bg-slate-50 p-6 text-center text-slate-500 font-medium">
            هذه التذكرة مغلقة ولا يمكن إضافة ردود جديدة.
          </div>
        )}
      </div>
    </div>
  );
}
