'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Send } from 'lucide-react';
import { replyToSupportTicket, closeSupportTicket } from '@/actions/support';
import { BusyButton, TextInput } from '@/components/forms/Form';

const UNEXPECTED = 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.';

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
      const result = await replyToSupportTicket(ticketId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText('');
      router.refresh();
    } catch {
      setError(UNEXPECTED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-white p-4">
      {error && (
        <p id={`reply-error-${ticketId}`} role="alert" className="mb-2 text-sm font-bold text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        {/* خانة في سطر الرد — عنوانها `aria-label` بدل عنوان ظاهر. */}
        <TextInput
          name="message"
          aria-label="الرد على التذكرة"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `reply-error-${ticketId}` : undefined}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim() && !busy) void send();
          }}
          placeholder="اكتب ردك هنا..."
          className="flex-1"
        />
        <BusyButton
          busy={busy}
          pendingLabel="جارٍ الإرسال…"
          disabled={!text.trim()}
          onClick={send}
          aria-label="إرسال الرد"
          className="shrink-0"
        >
          <Send className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
        </BusyButton>
      </div>
    </div>
  );
}

export function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // ⚠️ الزرار كان بيسكت لو الإغلاق فشل — دلوقتي الرسالة بتظهر جنبه.
  const [error, setError] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span role="alert" className="text-sm font-bold text-red-600">
          {error}
        </span>
      )}
      <BusyButton
        busy={busy}
        pendingLabel="جارٍ الإغلاق…"
        variant="secondary"
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const result = await closeSupportTicket(ticketId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          } catch {
            setError(UNEXPECTED);
          } finally {
            setBusy(false);
          }
        }}
        className="text-sm"
      >
        <Archive className="h-4 w-4" aria-hidden="true" />
        إغلاق التذكرة
      </BusyButton>
    </div>
  );
}
