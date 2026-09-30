'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, RotateCcw, Search } from 'lucide-react';
import { CONTENT_GROUPS, type ContentField } from '@/lib/site-content';
import { savePageContent } from '@/actions/content';
import type { SiteContent } from '@/lib/site-content';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500';

export function PageContentClient({ content }: { content: SiteContent }) {
  const [values, setValues] = useState<SiteContent>(content);
  const [openGroup, setOpenGroup] = useState<string>(CONTENT_GROUPS[0].id);
  const [query, setQuery] = useState('');
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [savedGroup, setSavedGroup] = useState<string | null>(null);
  const [error, setError] = useState('');

  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSavedGroup(null);
  };

  // البحث بيدوّر في اسم الخانة وفي النص نفسه — عشان تلاقي جملة شوفتها على
  // الموقع من غير ما تعرف في أنهي قسم.
  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    const found = new Set<string>();
    for (const group of CONTENT_GROUPS) {
      for (const field of group.fields) {
        const haystack = `${group.title} ${field.label} ${values[field.key] ?? ''}`;
        if (haystack.includes(q)) found.add(field.key);
      }
    }
    return found;
  }, [query, values]);

  const saveGroup = async (groupId: string) => {
    const group = CONTENT_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    setSavingGroup(groupId);
    setError('');
    setSavedGroup(null);
    try {
      await savePageContent(
        group.fields.map((f) => ({ key: f.key, value: values[f.key] ?? '' })),
      );
      setSavedGroup(groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ النصوص');
    } finally {
      setSavingGroup(null);
    }
  };

  const changedCount = (groupId: string) => {
    const group = CONTENT_GROUPS.find((g) => g.id === groupId);
    if (!group) return 0;
    return group.fields.filter(
      (f) => (values[f.key] ?? '').trim() !== f.fallback.trim(),
    ).length;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
        كل نص هنا مكتوب عليه مكانه على الموقع. لو مسحت خانة أو رجّعتها لنصها
        الأصلي، الموقع بيعرض النص الأصلي — يعني مستحيل تسيب مكان فاضي بالغلط.
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputClass} pr-12`}
          placeholder="ابحث عن جملة شفتها على الموقع…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {CONTENT_GROUPS.map((group) => {
        const visibleFields = matches
          ? group.fields.filter((f) => matches.has(f.key))
          : group.fields;
        if (matches && visibleFields.length === 0) return null;

        const isOpen = matches ? true : openGroup === group.id;
        const changed = changedCount(group.id);

        return (
          <div
            key={group.id}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen && !matches ? '' : group.id)}
              className="flex w-full items-center justify-between gap-4 p-6 text-right transition-colors hover:bg-slate-50"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-slate-800">
                    {group.title}
                  </span>
                  {changed > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      {changed} نص معدَّل
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-500" dir="ltr">
                  {group.path}
                </span>
              </div>
              <span className="text-sm font-bold text-slate-400">
                {group.fields.length} خانة
              </span>
            </button>

            {isOpen && (
              <div className="space-y-6 border-t border-slate-100 p-6">
                <Link
                  href={group.path}
                  target="_blank"
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  افتح الصفحة في تبويب جديد
                </Link>

                {visibleFields.map((field) => (
                  <Field
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ''}
                    onChange={(v) => set(field.key, v)}
                  />
                ))}

                <div className="flex items-center justify-end gap-4 border-t border-slate-100 pt-6">
                  {savedGroup === group.id && (
                    <span className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                      <Check className="h-5 w-5" /> تم الحفظ وظهر على الموقع
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => saveGroup(group.id)}
                    disabled={savingGroup === group.id}
                    className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingGroup === group.id ? 'جارٍ الحفظ…' : 'حفظ نصوص الصفحة'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ContentField;
  value: string;
  onChange: (value: string) => void;
}) {
  const isChanged = value.trim() !== field.fallback.trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-bold text-slate-700">{field.label}</label>
        {isChanged && (
          <button
            type="button"
            onClick={() => onChange(field.fallback)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            استعادة النص الأصلي
          </button>
        )}
      </div>

      {field.type === 'text' ? (
        <input
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <textarea
          rows={field.type === 'richtext' ? 14 : 3}
          className={`${inputClass} resize-y leading-relaxed`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.hint && (
        <p className="text-xs font-medium text-slate-500">{field.hint}</p>
      )}
    </div>
  );
}
