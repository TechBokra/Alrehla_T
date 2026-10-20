import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface DashboardPageHeaderProps {
  title: string;
  backHref?: string;
  action?: {
    label: string;
    href: string;
  };
}

export function DashboardPageHeader({ title, backHref, action }: DashboardPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 mb-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link 
            href={backHref} 
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
            aria-label="العودة"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        )}
        <h1 className="text-2xl font-black text-slate-800 md:text-3xl">{title}</h1>
      </div>
      
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
