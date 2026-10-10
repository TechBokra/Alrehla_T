'use client';

import React, { useState } from 'react';
import { useNow } from '@/components/providers/ClientTimeProvider';
import { dateKey } from '@/lib/time-values';
import { DayOfWeek, WeeklySlot } from '@/types';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  LayoutGrid,
  CalendarDays,
  Sparkles,
  Info,
} from 'lucide-react';

export const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'saturday', label: 'السبت', short: 'سبت' },
  { key: 'sunday', label: 'الأحد', short: 'أحد' },
  { key: 'monday', label: 'الإثنين', short: 'إثنين' },
  { key: 'tuesday', label: 'الثلاثاء', short: 'ثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء', short: 'أربعاء' },
  { key: 'thursday', label: 'الخميس', short: 'خميس' },
  { key: 'friday', label: 'الجمعة', short: 'جمعة' },
];

/**
 * الساعات المتاحة للاختيار السريع بنقرة واحدة داخل كل يوم
 */
const AVAILABLE_HOURS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

interface WeeklySchedulePickerProps {
  schedule: WeeklySlot[];
  onChange: (nextSchedule: WeeklySlot[]) => void;
  disabled?: boolean;
}

export function WeeklySchedulePicker({
  schedule,
  onChange,
  disabled = false,
}: WeeklySchedulePickerProps) {
  // نمط العرض: التركيز على يوم محدد افتراضياً (single) مع إمكانية التبديل لعرض الأيام السبعة معاً (grid)
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('single');
  const [activeDay, setActiveDay] = useState<DayOfWeek>('saturday');
  const [customTime, setCustomTime] = useState<Record<DayOfWeek, string>>({
    saturday: '17:30',
    sunday: '17:30',
    monday: '17:30',
    tuesday: '17:30',
    wednesday: '17:30',
    thursday: '17:30',
    friday: '17:30',
  });
  const [copiedDay, setCopiedDay] = useState<DayOfWeek | null>(null);
  const [timeError, setTimeError] = useState('');

  const now = useNow();
  const todayStr = dateKey(now);

  const getDaySlots = (day: DayOfWeek) => {
    return schedule
      .filter((s) => s.day === day)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const addSlot = (day: DayOfWeek, time: string) => {
    setTimeError('');
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setTimeError('يرجى إدخال الوقت بصيغة صحيحة (HH:MM)');
      return;
    }
    if (schedule.some((s) => s.day === day && s.time === time)) {
      setTimeError(`الموعد ${time} مضاف مسبقاً في يوم ${DAYS.find((d) => d.key === day)?.label}`);
      return;
    }

    const newSlot: WeeklySlot = {
      day,
      time,
      commitmentType: 'ongoing',
    };
    onChange([...schedule, newSlot]);
  };

  const toggleHour = (day: DayOfWeek, time: string) => {
    if (disabled) return;
    const exists = schedule.some((s) => s.day === day && s.time === time);
    if (exists) {
      removeSlot(day, time);
    } else {
      addSlot(day, time);
    }
  };

  const removeSlot = (day: DayOfWeek, time: string) => {
    if (disabled) return;
    onChange(schedule.filter((s) => !(s.day === day && s.time === time)));
  };

  const clearDay = (day: DayOfWeek) => {
    if (disabled) return;
    onChange(schedule.filter((s) => s.day !== day));
  };

  const copyDayToOtherDays = (sourceDay: DayOfWeek) => {
    if (disabled) return;
    const sourceSlots = getDaySlots(sourceDay);
    if (sourceSlots.length === 0) return;

    let updated = [...schedule];
    for (const d of DAYS) {
      if (d.key === sourceDay) continue;
      for (const src of sourceSlots) {
        if (!updated.some((s) => s.day === d.key && s.time === src.time)) {
          updated.push({
            ...src,
            day: d.key,
          });
        }
      }
    }
    onChange(updated);
    setCopiedDay(sourceDay);
    setTimeout(() => setCopiedDay(null), 3000);
  };

  const updateSlot = (
    day: DayOfWeek,
    time: string,
    updates: Partial<WeeklySlot>,
  ) => {
    if (disabled) return;
    const next = schedule.map((slot) => {
      if (slot.day === day && slot.time === time) {
        const merged = { ...slot, ...updates };
        if (merged.commitmentType === 'ongoing') {
          delete merged.commitmentEndsAt;
          delete merged.commitmentMonths;
        } else if (merged.commitmentType === 'fixed_term') {
          // حساب تاريخ نهاية افتراضي إذا لم يكن محدداً (30 يوماً من اليوم)
          if (!merged.commitmentEndsAt) {
            const nextMonth = new Date();
            nextMonth.setDate(nextMonth.getDate() + 30);
            merged.commitmentEndsAt = nextMonth.toISOString().split('T')[0];
          }

          // احتساب الشهور بالخلفية فقط للتوافق مع البيانات القديمة
          if (merged.commitmentEndsAt) {
            const daysDiff = Math.max(
              1,
              Math.ceil(
                (new Date(merged.commitmentEndsAt).getTime() - new Date().getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            );
            merged.commitmentMonths = Math.max(1, Math.round(daysDiff / 30));
          }
        }
        return merged;
      }
      return slot;
    });
    onChange(next);
  };

  const totalSlotsCount = schedule.length;
  const temporarySlotsCount = schedule.filter((s) => s.commitmentType === 'fixed_term').length;
  const ongoingSlotsCount = totalSlotsCount - temporarySlotsCount;

  // تنسيق التاريخ باللغة العربية لعرض اليوم المحدد بوضوح
  const formatDateArabic = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // مكوّن عرض اليوم ومحتوياته
  const renderDayCard = (day: { key: DayOfWeek; label: string; short: string }) => {
    const daySlots = getDaySlots(day.key);
    const isCopied = copiedDay === day.key;

    return (
      <div
        key={day.key}
        className={`flex flex-col rounded-3xl border bg-white shadow-xs transition-all ${
          daySlots.length > 0
            ? 'border-amber-200/90 ring-1 ring-amber-100'
            : 'border-slate-200'
        }`}
      >
        {/* رأس اليوم */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-4 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white font-black text-sm shadow-2xs">
              {day.short}
            </span>
            <div>
              <h4 className="font-black text-slate-800 text-base">{day.label}</h4>
              <p className="text-[11px] text-slate-500 font-semibold">
                {daySlots.length === 0 ? 'لا توجد ساعات' : `${daySlots.length} موعد محدد`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {daySlots.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => copyDayToOtherDays(day.key)}
                  title="نسخ أوقات هذا اليوم لباقي أيام الأسبوع"
                  className="rounded-lg p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100/70 transition-colors"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => clearDay(day.key)}
                  title="مسح ساعات هذا اليوم"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* جسم اليوم: اختيار الساعات وتفاصيلها */}
        <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            {/* رسالة نسخ اليوم إن وجدت */}
            {isCopied && (
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-xs font-bold text-emerald-800">
                <Check className="h-3.5 w-3.5" />
                <span>تم نسخ ساعات {day.label} لجميع أيام الأسبوع!</span>
              </div>
            )}

            {/* شبكة الساعات الشائعة للاختيار بنقرة واحدة داخل اليوم */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                اختر الساعات المتاحة في يوم {day.label}:
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-1.5">
                {AVAILABLE_HOURS.map((hour) => {
                  const isSelected = daySlots.some((s) => s.time === hour);
                  return (
                    <button
                      key={hour}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleHour(day.key, hour)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                          : 'bg-slate-50/90 border-slate-200/90 text-slate-700 hover:bg-white hover:border-amber-400'
                      }`}
                      title={isSelected ? `إلغاء الساعة ${hour}` : `اختيار الساعة ${hour}`}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* إضافة ساعة مخصصة كدقيقة معينة (مثل 17:30) */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">
                أو إضافة وقت مخصص:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  disabled={disabled}
                  value={customTime[day.key] || '17:30'}
                  onChange={(e) =>
                    setCustomTime({
                      ...customTime,
                      [day.key]: e.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 flex-1"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => addSlot(day.key, customTime[day.key] || '17:30')}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-800 p-2 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  title="إضافة الوقت"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* قائمة الساعات المحددة مع ضبط المواعيد المؤقتة وتاريخ النهاية باليوم */}
            {daySlots.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <span className="text-[11px] font-bold text-slate-600 block">
                  الساعات المختارة وضبط التوقيت:
                </span>
                <div className="space-y-2">
                  {daySlots.map((slot) => {
                    const isFixed = slot.commitmentType === 'fixed_term';

                    return (
                      <div
                        key={`${slot.day}-${slot.time}`}
                        className={`rounded-2xl border p-2.5 transition-all text-xs ${
                          isFixed
                            ? 'border-amber-300 bg-amber-50/50'
                            : 'border-slate-200 bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span className="font-black text-slate-900 text-sm">
                              {slot.time}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* نوع الموعد: دائم مستمر أو مؤقت */}
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[10px] font-bold">
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  updateSlot(slot.day, slot.time, {
                                    commitmentType: 'ongoing',
                                  })
                                }
                                className={`rounded px-1.5 py-0.5 transition-colors ${
                                  !isFixed
                                    ? 'bg-amber-600 text-white font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                دائم
                              </button>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  updateSlot(slot.day, slot.time, {
                                    commitmentType: 'fixed_term',
                                  })
                                }
                                className={`rounded px-1.5 py-0.5 transition-colors ${
                                  isFixed
                                    ? 'bg-amber-600 text-white font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                وقت مؤقت
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => removeSlot(slot.day, slot.time)}
                              className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="حذف هذا الموعد"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* عند اختيار وقت مؤقت: تاريخ نهاية الموعد باليوم فقط */}
                        {isFixed && (
                          <div className="mt-2 pt-2 border-t border-amber-200/80 space-y-1">
                            <label className="block text-[11px] font-bold text-amber-950">
                              تاريخ نهاية الموعد باليوم:
                            </label>
                            <input
                              type="date"
                              disabled={disabled}
                              min={todayStr}
                              value={slot.commitmentEndsAt || ''}
                              onChange={(e) =>
                                updateSlot(slot.day, slot.time, {
                                  commitmentEndsAt: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 outline-none focus:border-amber-500 shadow-2xs"
                            />
                            <p className="text-[10px] font-medium text-amber-800">
                              {slot.commitmentEndsAt ? (
                                <>
                                  ينتهي بنهاية:{' '}
                                  <strong className="font-bold text-amber-950">
                                    {formatDateArabic(slot.commitmentEndsAt)}
                                  </strong>
                                </>
                              ) : (
                                <>يرجى تحديد يوم نهاية الموعد المؤقت.</>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* شريط الإحصائيات والمعلومات العلوية */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-amber-50/70 border border-amber-200/80 p-5 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white font-black shadow-xs">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-black text-slate-800 text-base">
              إجمالي ساعات العمل المتاحة:{' '}
              <span className="text-amber-700">{totalSlotsCount} موعد أسبوعياً</span>
            </h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1 font-medium">
              <span>{ongoingSlotsCount} موعد دائم مستمر</span>
              {temporarySlotsCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-800 font-bold">
                    {temporarySlotsCount} موعد مؤقت ينتهي بتاريخ محدد باليوم
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* أزرار التبديل بين طريقة العرض: عرض الأسبوع كاملاً أو يوم بيوم */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>الأيام السبعة معاً</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                viewMode === 'single'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>يوم محدد</span>
            </button>
          </div>
        </div>
      </div>

      {timeError && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-sm font-bold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{timeError}</span>
        </div>
      )}

      {/* تنبيه توضيحي لطريقة عمل المواعيد المؤقتة والدائمة */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800">طريقة اختيار الساعات:</strong> يمكنك النقر مباشرة على أي ساعة داخل أي يوم من الأيام السبعة لتفعيلها أو إيقافها. عند الرغبة في موعد لفترة محددة، اختر <strong>(وقت مؤقت)</strong> وحدد تاريخ نهايته باليوم من التقويم وسيتوقف إتاحته للحجز تلقائياً بعد هذا التاريخ.
        </div>
      </div>

      {/* الحالة 1: عرض الأيام السبعة معاً (Grid) */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS.map((day) => renderDayCard(day))}
        </div>
      )}

      {/* الحالة 2: التركيز على يوم واحد (Tabs) */}
      {viewMode === 'single' && (
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {DAYS.map((day) => {
              const count = getDaySlots(day.key).length;
              const isSelected = activeDay === day.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setActiveDay(day.key)}
                  className={`flex flex-col items-center justify-center rounded-2xl py-3 px-1.5 transition-all text-center border ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[1.02]'
                      : count > 0
                      ? 'bg-amber-50/80 border-amber-200 text-slate-800 hover:bg-amber-100/60'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs md:text-sm font-bold truncate max-w-full">
                    {day.label}
                  </span>
                  <span
                    className={`mt-1.5 rounded-full px-2 py-0.5 text-[11px] font-black ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : count > 0
                        ? 'bg-amber-200/90 text-amber-900'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            {DAYS.map((day) => {
              if (day.key !== activeDay) return null;
              return renderDayCard(day);
            })}
          </div>
        </div>
      )}
    </div>
  );
}
