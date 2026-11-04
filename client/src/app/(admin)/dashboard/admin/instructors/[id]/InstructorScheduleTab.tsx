'use client';

import { useState } from 'react';
import type { WeeklySlot } from '@/types';
import { Calendar, CalendarDays, Clock, LayoutDashboard } from 'lucide-react';
import { ARABIC_DAYS, DAY_KEYS } from './schedule-days';

/**
 * تبويب «الجدول الأسبوعي» في صفحة المدرب — اتفصل من
 * `AdminInstructorClient` (كان أكبر ملف في المشروع). للعرض بس.
 */
export function InstructorScheduleTab({ weeklySlots }: { weeklySlots: WeeklySlot[] }) {
  const [scheduleViewMode, setScheduleViewMode] = useState<'single_day' | 'week_grid'>('single_day');
  const [selectedDay, setSelectedDay] = useState<string>('saturday');
  const bookedSlotsCount = weeklySlots.filter((s) => s.isBooked).length;
  const tempSlotsCount = weeklySlots.filter((s) => s.commitmentType === 'fixed_term').length;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span>الجدول الأسبوعي المعتمد حالياً ({weeklySlots.length} موعد)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            استعراض المواعيد المتاحة والمحجوزة والمؤقتة للمدرب.
          </p>
        </div>

        {/* محوّل العرض: يوم محدد (افتراضي) أو الأسبوع كاملاً */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setScheduleViewMode('single_day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              scheduleViewMode === 'single_day'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>يوم محدد (افتراضي)</span>
          </button>
          <button
            type="button"
            onClick={() => setScheduleViewMode('week_grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              scheduleViewMode === 'week_grid'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>الأسبوع كاملاً</span>
          </button>
        </div>
      </div>

      {/* شريط الإحصاءات السريعة للجدول */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100 text-center">
          <span className="text-[11px] font-bold text-slate-400 block">إجمالي المواعيد</span>
          <span className="text-lg font-black text-slate-800">{weeklySlots.length}</span>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 border border-emerald-100 text-center">
          <span className="text-[11px] font-bold text-emerald-700 block">المواعيد المحجوزة</span>
          <span className="text-lg font-black text-emerald-900">{bookedSlotsCount}</span>
        </div>
        <div className="rounded-2xl bg-amber-50 p-3 border border-amber-100 text-center">
          <span className="text-[11px] font-bold text-amber-700 block">المواعيد المؤقتة</span>
          <span className="text-lg font-black text-amber-900">{tempSlotsCount}</span>
        </div>
      </div>

      {weeklySlots.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">لا يوجد جدول أسبوعي معتمد للمدرب.</div>
      ) : scheduleViewMode === 'single_day' ? (
        /* نمط العرض الأول: يوم محدد (الشكل الافتراضي الرشيق) */
        <div className="space-y-4">
          {/* شريط أزرار الأيام */}
          <div className="flex border-b border-slate-100 pb-2 overflow-x-auto gap-1.5">
            {DAY_KEYS.map((dayKey) => {
              const daySlotsCount = weeklySlots.filter((s) => s.day === dayKey).length;
              const isSelected = selectedDay === dayKey;
              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDay(dayKey)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{ARABIC_DAYS[dayKey]}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {daySlotsCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* مواعيد اليوم المحدد */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <h4 className="font-bold text-slate-800 text-sm mb-3">
              مواعيد يوم {ARABIC_DAYS[selectedDay]}:
            </h4>
            {(() => {
              const daySlots = weeklySlots.filter((s) => s.day === selectedDay);
              if (daySlots.length === 0) {
                return (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    لا توجد مواعيد معتمدة في هذا اليوم.
                  </p>
                );
              }
              return (
                <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                  {daySlots.map((s) => (
                    <div
                      key={s.time}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-black text-slate-900 text-sm font-mono">{s.time}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {s.isBooked && (
                          <span className="rounded bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 text-[10px] font-bold">
                            محجوز
                          </span>
                        )}
                        {s.commitmentType === 'fixed_term' && (
                          <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[10px] font-bold">
                            مؤقت حتى: {s.commitmentEndsAt || 'تاريخ محدد'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* نمط العرض الثاني: الأسبوع كاملاً */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DAY_KEYS.map((dayKey) => {
            const daySlots = weeklySlots.filter((s) => s.day === dayKey);
            if (daySlots.length === 0) return null;
            return (
              <div key={dayKey} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-800 text-xs border-b border-slate-200/60 pb-1.5">
                  <span>{ARABIC_DAYS[dayKey]}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{daySlots.length} موعد</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {daySlots.map((s) => (
                    <div
                      key={s.time}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-2xs"
                    >
                      <span className="font-bold text-slate-800 font-mono">{s.time}</span>
                      {s.isBooked && <span className="text-rose-600 font-bold mr-1 text-[10px]">(محجوز)</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
