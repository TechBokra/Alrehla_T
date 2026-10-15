'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flag, Share2 } from 'lucide-react';
import { addComment, getMyReactions, reportContent, setReaction } from '@/actions/aqlam';
import { AQLAM_LIMITS, AQLAM_REACTIONS, REPORT_REASONS } from '@/lib/aqlam/post';

/**
 * جزيرة التفاعل — الجزء الوحيد في الصفحة اللي بيحتاج JavaScript.
 * النص والتعليقات الموجودة بتتعرض من الخادم؛ هنا بس: الملصقات، كتابة تعليق،
 * بلاغ، ومشاركة.
 */

type CommentView = { id: string; author: string; isInstructor: boolean; body: string; date: string };

const REACTION_EMOJI: Record<string, string> = { heart: '❤️', star: '⭐', spark: '✨' };

export function PostActions({
  postId,
  title,
  reactionCount,
  commentsEnabled,
  comments,
}: {
  postId: string;
  title: string;
  reactionCount: number;
  commentsEnabled: boolean;
  comments: CommentView[];
}) {
  const router = useRouter();
  const [mine, setMine] = useState<string[]>([]);
  const [count, setCount] = useState(reactionCount);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [comment, setComment] = useState('');
  const [reporting, setReporting] = useState(false);
  const [pending, startTransition] = useTransition();

  // ملصقاتي — تتحمّل بعد ظهور الصفحة، فالصفحة نفسها تفضل مخزّنة.
  useEffect(() => {
    let alive = true;
    getMyReactions(postId).then((kinds) => {
      if (alive) setMine(kinds);
    });
    return () => {
      alive = false;
    };
  }, [postId]);

  const signInHref = `/sign-in?next=${encodeURIComponent(`/aqlam/p/${postId}`)}`;

  function toggle(kind: string) {
    const on = !mine.includes(kind);
    setNotice(null);
    startTransition(async () => {
      const res = await setReaction(postId, kind, on);
      if (!res.ok) {
        if (res.needsSignIn) setNeedsSignIn(true);
        else setNotice({ kind: 'error', text: res.error });
        return;
      }
      setMine((cur) => (on ? [...cur, kind] : cur.filter((k) => k !== kind)));
      setCount(res.reactionCount);
    });
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const res = await addComment(postId, comment);
      if (!res.ok) {
        if (res.needsSignIn) setNeedsSignIn(true);
        else setNotice({ kind: 'error', text: res.error });
        return;
      }
      setComment('');
      setNotice({ kind: 'ok', text: res.message ?? 'تعليقك اتنشر.' });
      router.refresh();
    });
  }

  function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const reason = String(form.get('reason') ?? '');
    const details = String(form.get('details') ?? '');
    startTransition(async () => {
      const res = await reportContent('post', postId, reason, details);
      if (!res.ok) {
        if (res.needsSignIn) setNeedsSignIn(true);
        else setNotice({ kind: 'error', text: res.error });
        return;
      }
      setReporting(false);
      setNotice({ kind: 'ok', text: res.message ?? 'وصلنا بلاغك.' });
    });
  }

  async function share() {
    const url = `${window.location.origin}/aqlam/p/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // المستخدم قفل نافذة المشاركة.
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank', 'noopener,noreferrer');
  }

  const btn =
    'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none disabled:opacity-60 ';

  return (
    <div className="space-y-8 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="التشجيع">
        {AQLAM_REACTIONS.map((r) => {
          const active = mine.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => toggle(r.key)}
              disabled={pending}
              aria-pressed={active}
              className={
                btn +
                (active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400')
              }
            >
              <span aria-hidden="true">{REACTION_EMOJI[r.key]}</span>
              {r.label}
            </button>
          );
        })}
        <span className="text-sm font-bold text-slate-500">
          {count > 0 ? `${count.toLocaleString('ar-EG')} تشجيع` : 'كن أول من يشجّع'}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={share} className={btn + 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          مشاركة
        </button>
        <button
          type="button"
          onClick={() => setReporting((v) => !v)}
          aria-expanded={reporting}
          className={btn + 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}
        >
          <Flag className="h-4 w-4" aria-hidden="true" />
          بلاغ
        </button>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl px-4 py-3 text-sm font-bold ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      {needsSignIn && (
        <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          لازم تسجّل دخولك الأول.{' '}
          <Link href={signInHref} className="underline underline-offset-4">
            تسجيل الدخول
          </Link>
        </p>
      )}

      {reporting && (
        <form onSubmit={submitReport} className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-black text-slate-900">إيه المشكلة في النص ده؟</legend>
            {REPORT_REASONS.map((r, i) => (
              <label key={r.key} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
                <input type="radio" name="reason" value={r.key} defaultChecked={i === 0} className="h-4 w-4" />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="block space-y-1 text-sm font-bold text-slate-700">
            تفاصيل (اختياري)
            <textarea
              name="details"
              maxLength={500}
              rows={2}
              className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="min-h-[44px] rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
          >
            إرسال البلاغ
          </button>
        </form>
      )}

      {commentsEnabled ? (
        <section aria-labelledby="comments-title" className="space-y-5">
          <h2 id="comments-title" className="text-xl font-black text-slate-900">
            التعليقات {comments.length > 0 && `(${comments.length.toLocaleString('ar-EG')})`}
          </h2>

          {comments.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">لسه مفيش تعليقات. اكتب كلمة طيّبة.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-sm font-black text-slate-900">
                    {c.author}
                    {c.isInstructor && (
                      <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">
                        مدرّب
                      </span>
                    )}
                    <span className="mr-2 text-xs font-medium text-slate-400">{c.date}</span>
                  </p>
                  <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submitComment} className="space-y-3">
            <label htmlFor="aqlam-comment" className="block text-sm font-bold text-slate-700">
              اكتب تعليقًا طيّبًا
            </label>
            <textarea
              id="aqlam-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={AQLAM_LIMITS.commentMax}
              rows={3}
              required
              className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
            />
            <p className="text-xs font-medium text-slate-400">
              من غير أرقام تليفون أو روابط أو حسابات تواصل.
            </p>
            <button
              type="submit"
              disabled={pending || comment.trim().length === 0}
              className="min-h-[44px] rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
            >
              أضف التعليق
            </button>
          </form>
        </section>
      ) : (
        <p className="text-sm font-medium text-slate-500">التعليقات مقفولة على النص ده.</p>
      )}
    </div>
  );
}
