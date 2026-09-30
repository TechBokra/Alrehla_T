import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getJoinRequests } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { User, Mail, Phone, Calendar, Briefcase, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { joinRequestRoleLabel } from '@/lib/join-roles';

import { JoinRequestActions } from './JoinRequestActions';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSupport')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const requests = await getJoinRequests();
  const target = requests.find(r => r.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`طلب انضمام: ${target.applicantName}`} backHref="/dashboard/admin/join-requests" />
      
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="bg-slate-50 border-b border-slate-200 p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm text-amber-600 text-2xl font-black">
              {target.applicantName[0]}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">{target.applicantName}</h2>
              <div className="flex items-center gap-2 mt-1 text-slate-500 font-medium">
                <Briefcase className="h-4 w-4" />
                {`طلب انضمام: ${joinRequestRoleLabel(target.requestedRole)}`}
              </div>
            </div>
          </div>
          <div>
            <StatusBadge 
              type={target.status === 'approved' ? 'success' : target.status === 'rejected' ? 'danger' : 'warning'} 
              label={target.status === 'approved' ? 'مقبول' : target.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-slate-400" />
              <div className="min-w-0">
                <div className="mb-1 text-sm text-slate-500">البريد الإلكتروني</div>
                <div className="truncate font-bold text-slate-800" dir="ltr">
                  {target.email || '—'}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <div className="mb-1 text-sm text-slate-500">رقم الهاتف</div>
                <div className="font-bold text-slate-800" dir="ltr">
                  {target.phone || '—'}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm text-slate-500 mb-1">تاريخ التقديم</div>
                <div className="font-bold text-slate-800">{formatDate(target.createdAt)}</div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-8">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              نبذة عن المتقدم
            </h3>
            {/* The same invented paragraph used to be shown as every
                applicant's own words. */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 leading-relaxed whitespace-pre-wrap text-slate-700">
              {target.message || <span className="text-slate-400">لم يكتب المتقدم رسالة.</span>}
            </div>
          </div>
          
          {target.requestedRole !== 'other' && (
            <div className="border-t border-slate-100 pt-8">
              <h3 className="font-bold text-slate-800 mb-4">روابط النماذج السابقة (Portfolio)</h3>
              {target.portfolioUrl ? (
                <a
                  href={target.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-600 underline"
                  dir="ltr"
                >
                  {target.portfolioUrl}
                </a>
              ) : (
                <p className="font-medium text-slate-500">لا توجد روابط أعمال مسجّلة.</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-8 border-t border-slate-100 flex flex-wrap gap-4">
            {target.status === 'pending' ? (
              <JoinRequestActions requestId={target.id} />
            ) : (
              <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                <Clock className="h-5 w-5" />
                تم اتخاذ إجراء مسبقاً على هذا الطلب
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
