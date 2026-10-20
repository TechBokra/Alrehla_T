'use client';

import React, { useId, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * اختيار مسؤول **بالبحث بالاسم** — بدل قايمة منسدلة قصيرة.
 *
 * ── ليه ─────────────────────────────────────────────────────
 *
 * التسنيد كان `<select>` فيه كل الإداريين. ده شغل لما الفريق تلاتة،
 * وبيوقع لما يبقى عشرين: قايمة طويلة بتتلفّ، وأسماء متشابهة جنب بعضها،
 * ومفيش طريقة تكتب الاسم اللي انت عارفه. دلوقتي بتكتب أول حرفين
 * وبتختار.
 *
 * ⚠️ **الدور الإداري مكتوب جنب كل اسم**: «أحمد» و«أحمد» في فريق واحد
 *    حالة حقيقية، والتسنيد للشخص الغلط مابيبانش غير لما المهمة تفوت.
 *
 * ⚠️ **بحث عربي بيتطبّع قبل المقارنة**: الهمزات (أ إ آ ا) والتاء
 *    المربوطة والياء والتشكيل بتخلّي «احمد» ماتلاقيش «أحمد» — واللي
 *    بيكتب بسرعة مابيحطّش همزة. والتطبيع بيشيل الفرق.
 */

export type PickablePerson = { id: string; name: string; roleName?: string };

/** تطبيع عربي للبحث: التشكيل والتطويل يتشالوا، والحروف المتشابهة تتوحّد. */
function normalize(value: string): string {
  return value
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

export function PersonPicker({
  people,
  value,
  onChange,
  multiple = false,
  me,
  disabled = false,
  label,
  hint,
  emptyLabel = 'من غير مسؤول',
  allowEmpty = true,
}: {
  people: PickablePerson[];
  /** المختارين دلوقتي. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** يسمح بأكتر من واحد (شاشة التوزيع) أو واحد بس (تسنيد مهمة). */
  multiple?: boolean;
  /** رقم الإداري الحالي — بيتعلّم عليه «(أنا)». */
  me?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
  emptyLabel?: string;
  /** زرار «من غير مسؤول» — مش كل شاشة بتسمح بده. */
  allowEmpty?: boolean;
}) {
  const [query, setQuery] = useState('');
  const listId = useId();

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const matches = useMemo(() => {
    const q = normalize(query);
    const pool = people.filter((p) => !value.includes(p.id));
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((p) => normalize(p.name).includes(q) || normalize(p.roleName ?? '').includes(q))
      .slice(0, 8);
  }, [people, query, value]);

  const pick = (id: string) => {
    onChange(multiple ? [...value, id] : [id]);
    setQuery('');
  };

  const drop = (id: string) => onChange(value.filter((x) => x !== id));

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-bold text-slate-800">{label}</p>}

      {/* المختارين — شيلة بزرار × لكل واحد، عشان اللي اتسند يبان من غير فتح القايمة. */}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => {
            const p = byId.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-3 pl-1.5 text-sm font-bold text-slate-800"
              >
                <span>
                  {p?.name ?? 'حساب مش موجود'}
                  {id === me ? ' (أنا)' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => drop(id)}
                  disabled={disabled}
                  aria-label={`شيل ${p?.name ?? 'المسؤول'}`}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(multiple || value.length === 0) && (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            {/* خانة فلترة، مش `combobox`: الدور الغلط بيخلّي قارئ الشاشة
                يوعد بسلوك (أسهم، تحديد) الخانة مابتعملهوش. */}
            <input
              type="search"
              aria-label="دوّر بالاسم"
              aria-describedby={listId}
              value={query}
              disabled={disabled}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="دوّر بالاسم…"
              className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-white py-2 pr-10 pl-3 text-base font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:opacity-50 md:text-sm"
            />
          </div>

          <ul id={listId} className="space-y-1">
            {matches.length === 0 ? (
              <li className="px-1 py-2 text-sm font-medium text-slate-500">
                {query.trim() ? 'مفيش حد بالاسم ده.' : 'مفيش حسابات إدارية متاحة.'}
              </li>
            ) : (
              matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    disabled={disabled}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-right transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="text-sm font-bold text-slate-800">
                      {p.name}
                      {p.id === me ? ' (أنا)' : ''}
                    </span>
                    {p.roleName && (
                      <span className="text-xs font-medium text-slate-500">{p.roleName}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}

      {allowEmpty && value.length > 0 && !multiple && (
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={disabled}
          className="text-xs font-bold text-slate-500 underline hover:text-slate-800 disabled:opacity-50"
        >
          {emptyLabel}
        </button>
      )}

      {hint && <p className="text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
}
