import { LucideIcon } from 'lucide-react';
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, trendUp }) => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-500">{title}</h3>
        <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-3xl font-black text-slate-800">{value}</div>
      {trend && (
        <div className={`mt-2 text-xs font-bold ${trendUp ? 'text-emerald-600' : 'text-slate-500'}`}>
          {trend}
        </div>
      )}
    </div>
  );
};
