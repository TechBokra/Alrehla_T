'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Send } from 'lucide-react';
import { replyToSupportTicket, closeSupportTicket } from '@/actions/support';

/**
 * Replying to and closing a support ticket.
 *
 * Both controls existed as plain buttons with no handler: a customer's ticket
 * could be read but never answered or closed.
 */
export function TicketReplyBox({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await replyToSupportTicket(ticketId, text);
      setText('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الرد');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-white p-4">
      {error && <p className="mb-2 text-sm font-bold text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim() && !busy) void send();
          }}
          placeholder="اكتب ردك هنا..."
          className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-slate-800 transition-all focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={send}
          aria-label="إرسال الرد"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          <Send className="h-5 w-5 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}

export function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await closeSupportTicket(ticketId);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
    >
      <Archive className="h-4 w-4" />
      إغلاق التذكرة
    </button>
  );
}
