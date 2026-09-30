'use client';

import React from 'react';
import { setDisabledNotificationTypes } from '@/actions/notifications-admin';

type EventRow = {
  key: string;
  label: string;
  description: string;
  audience: string;
  locked?: boolean;
};

export function TypesForm({
  events,
  disabled,
}: {
  events: EventRow[];
  disabled: string[];
}) {
  const [off, setOff] = React.useState<string[]>(disabled);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await setDisabledNotificationTypes(off);
    setSaving(false);
    setMessage(
      res.ok ? { ok: true, text: 'اتحفظ.' } : { ok: false, text: res.error }
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const isOn = !off.includes(event.key);
        return (
          <div
            key={event.key}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black text-slate-800">{event.label}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                  {event.audience}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {event.description}
              </p>
            </div>

            {event.locked ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                دائمًا شغّال
              </span>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setOff((prev) =>
                    isOn ? [...prev, event.key] : prev.filter((k) => k !== event.key)
                  )
                }
                aria-pressed={isOn}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  isOn
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {isOn ? 'شغّال' : 'موقوف'}
              </button>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-4 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ…' : 'حفظ'}
        </button>
        {message && (
          <p className={`text-sm font-bold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
