'use client';
import React from 'react';
import { PortfolioDocument } from '@/types';
import { FileEdit, FileText, CheckCircle2, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

interface Props {
  documents: PortfolioDocument[];
}

export function PortfolioListClient({ documents }: Props) {
  
  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'draft': return <StatusBadge type="neutral" label="مسودة" />;
      case 'submitted': return <StatusBadge type="warning" label="قيد المراجعة" />;
      case 'reviewed': return <StatusBadge type="success" label="تمت المراجعة" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link 
          href="/dashboard/student/portfolio/new" 
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 shadow-md"
        >
          <Plus className="h-5 w-5" />
          كتابة نص جديد
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {documents.map(doc => (
          <Link href={`/dashboard/student/portfolio/${doc.id}`} key={doc.id} className="block group">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="h-6 w-6" />
                </div>
                {getStatusDisplay(doc.status)}
              </div>
              
              <h3 className="font-black text-slate-800 text-lg mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">{doc.title}</h3>
              <p className="text-slate-500 text-sm line-clamp-3 flex-1 mb-4">
                {doc.content}
              </p>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(doc.updatedAt).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE })}
                </div>
                {doc.status === 'reviewed' && (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    يوجد تقييم
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}

        {documents.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 rounded-3xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-500">
            <FileEdit className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">لا توجد نصوص بعد</h3>
            <p>ابدأ بكتابة مسودتك الأولى الآن ليراجعها المدرب.</p>
          </div>
        )}
      </div>
    </div>
  );
}
