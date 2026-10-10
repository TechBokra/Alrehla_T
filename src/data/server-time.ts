import 'server-only';
import { cache } from 'react';
import { differenceInYears, isAfter, isBefore, isSameDay, isValid, parseISO } from 'date-fns';
import { cairoParts } from '@/lib/timezone';

/** React.cache is request/render-scoped, never a module-level frozen timestamp. */
export const getServerNow = cache(() => new Date());

export function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

export function cairoCalendarDate(date: Date): Date {
  const p = cairoParts(date);
  return parseISO(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`);
}

export function isCairoToday(value: string, now: Date): boolean {
  const date = validDate(value);
  return !!date && isSameDay(cairoCalendarDate(date), cairoCalendarDate(now));
}

export function ageAt(birthDate: string | null | undefined, now: Date): number | null {
  const date = validDate(birthDate);
  const today = cairoCalendarDate(now);
  return date && !isBefore(today, date) ? differenceInYears(today, date) : null;
}

export function canChangeSessionAt(session: { scheduledAt: string; status: string }, now: Date): boolean {
  const date = validDate(session.scheduledAt);
  return session.status !== 'completed' && session.status !== 'cancelled' && !!date && isAfter(date, now);
}
