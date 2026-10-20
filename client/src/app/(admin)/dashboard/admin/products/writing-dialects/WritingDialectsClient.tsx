'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminDialect } from '@/data/domains/(admin)/writing/queries';
import { addWritingDialect, updateWritingDialect, type DialectResult } from '@/actions/writing-dialects';
import { TextInput, Checkbox, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

function Row({
  dialect,
  run,
  busyKey,
}: {
  dialect: AdminDialect;
  run: (key: string, fn: () => Promise<DialectResult>) => Promise<boolean>;
  busyKey: string | null;
}) {
  const [name, setName] = useState(dialect.nameAr);
  const [active, setActive] = useState(dialect.isActive);
  const dirty = name.trim() !== dialect.nameAr || active !== dialect.isActive;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <code className="w-24 shrink-0 text-xs text-slate-500">{dialect.code}</code>
      <TextInput
        aria-label={`اسم اللهجة ${dialect.code}`}
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1"
      />
      <Checkbox label="فعّالة" checked={active} onChange={(e) => setActive(e.target.checked)} />
      <BusyButton
        type="button"
        busy={busyKey === dialect.code}
        disabled={!dirty || busyKey !== null}
        onClick={() =>
          run(dialect.code, () =>
            updateWritingDialect({ code: dialect.code, nameAr: name, isActive: active }),
          )
        }
      >
        حفظ
      </BusyButton>
    </li>
  );
}

export function WritingDialectsClient({ dialects }: { dialects: AdminDialect[] }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');

  const run = async (key: string, fn: () => Promise<DialectResult>) => {
    setBusyKey(key);
    setError('');
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error || 'تعذّر الحفظ');
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && <FormError message={error} />}
      <ul className="space-y-2">
        {dialects.map((d) => (
          <Row key={`${d.code}:${d.nameAr}:${d.isActive}`} dialect={d} run={run} busyKey={busyKey} />
        ))}
      </ul>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="font-bold text-slate-800">إضافة لهجة</h2>
        <div className="flex flex-wrap items-center gap-3">
          <TextInput
            aria-label="كود اللهجة"
            placeholder="الكود: مثال jordanian"
            value={code}
            dir="ltr"
            maxLength={20}
            onChange={(e) => setCode(e.target.value)}
            className="w-48"
          />
          <TextInput
            aria-label="اسم اللهجة"
            placeholder="الاسم: اللهجة الأردنية"
            value={nameAr}
            maxLength={60}
            onChange={(e) => setNameAr(e.target.value)}
            className="min-w-0 flex-1"
          />
          <BusyButton
            type="button"
            busy={busyKey === '__add'}
            disabled={busyKey !== null}
            onClick={async () => {
              const ok = await run('__add', () => addWritingDialect({ code, nameAr }));
              if (ok) {
                setCode('');
                setNameAr('');
              }
            }}
          >
            إضافة
          </BusyButton>
        </div>
      </section>
    </div>
  );
}
