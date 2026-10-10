'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { ar } from 'react-day-picker/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useNow } from '@/components/providers/ClientTimeProvider';
import { calendarDate } from '@/lib/time-values';
import 'react-day-picker/style.css';

interface BirthDatePickerProps {
  /** ISO date string, e.g. "2012-04-04", or '' when empty */
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fromISO = (s: string): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
};

/** Always day/month/year, regardless of browser or OS settings. */
const formatDisplay = (s: string) => {
  const d = fromISO(s);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
};

export function BirthDatePicker({ value, onChange, id }: BirthDatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = fromISO(value);
  const now = useNow();
  const today = calendarDate(new Date(now));

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-right text-sm text-slate-700 transition-colors hover:border-slate-300"
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={value ? 'font-medium' : 'text-slate-400'}>
          {value ? formatDisplay(value) : 'يوم / شهر / سنة'}
        </span>
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute right-0 z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <DayPicker
            mode="single"
            locale={ar}
            dir="rtl"
            captionLayout="dropdown"
            startMonth={new Date(today.getFullYear() - 100, 0)}
            endMonth={today}
            defaultMonth={selected ?? new Date(today.getFullYear() - 8, 0)}
            selected={selected}
            disabled={{ after: today }}
            onSelect={(date) => {
              if (date) {
                onChange(toISO(date));
                setOpen(false);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
