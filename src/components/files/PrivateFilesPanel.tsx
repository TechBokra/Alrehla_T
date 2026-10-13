'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { cloudinaryPost } from '@/lib/cloudinary';
import {
  deletePrivateFile,
  getDocumentFileTicket,
  getOrderFileTicket,
  getPrivateFileLink,
  registerDocumentFile,
  registerOrderFile,
  type FileTicketResult,
} from '@/actions/private-files';
import {
  acceptAttr,
  fileProblem,
  formatBytes,
  kindsLabel,
  retentionNotice,
  type FileRules,
} from '@/lib/private-files';
import type { PrivateFileView } from '@/data/domains/(shared)/files/queries';
import { FormError } from '@/components/ui/FormError';

/**
 * ملفات الطلب أو المستند (ملف 20) — القايمة، والتحميل، والرفع.
 *
 * الرفع ٣ خطوات (التفاصيل في `actions/private-files`): تذكرة من الخادم،
 * رفع مباشر على Cloudinary (مخفي)، وبعدين الخادم بيتأكد ويسجّل.
 * والتحميل برابط بيخلص بعد دقايق — مفيش رابط دائم في الصفحة.
 */
export function PrivateFilesPanel({
  owner,
  files,
  loadError,
  rules,
  canUpload,
  retentionDays,
  closedLabel,
  title = 'الملفات',
  otherSideLabel,
  emptyText = 'مفيش ملفات لسه.',
}: {
  owner: { orderId: string } | { documentId: string };
  files: PrivateFileView[];
  loadError?: string | null;
  rules: FileRules;
  canUpload: boolean;
  retentionDays: number;
  /** «قفل الطلب» / «مراجعة المدرب» — لجملة التنبيه. */
  closedLabel: string;
  title?: string;
  /** اسم الطرف التاني على ملفاته: «من مقدّم الخدمة»، «تصحيح المدرب». */
  otherSideLabel: string;
  emptyText?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [registrationIntentId, setRegistrationIntentId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  // المسح على خطوتين: «مسح» ← «متأكد؟ امسح» (مالوش رجوع).
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = async (id: string) => {
    setError('');
    setDeleting(id);
    try {
      const result = await deletePrivateFile(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(result.deletionState === 'pending'
        ? 'تم تسجيل طلب الحذف. هنعيد المحاولة تلقائيًا لو مساحة التخزين مش متاحة.'
        : 'تم حذف الملف.');
      setConfirming(null);
      router.refresh();
    } catch {
      setError('تعذّر مسح الملف — جرّب تاني');
    } finally {
      setDeleting(null);
    }
  };

  const finishRegistration = async (intentId: string) => {
    const saved = 'orderId' in owner
      ? await registerOrderFile(owner.orderId, intentId)
      : await registerDocumentFile(owner.documentId, intentId);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    setRegistrationIntentId(null);
    router.refresh();
  };

  const retryRegistration = async () => {
    if (!registrationIntentId || busy) return;
    setBusy(true);
    setError('');
    try {
      await finishRegistration(registrationIntentId);
    } catch {
      setError('تعذّر حفظ الملف — جرّب تاني بنفس الرفع.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setError('');
    setNotice('');
    const problem = fileProblem(file, rules);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const ticket: FileTicketResult =
        'orderId' in owner
          ? await getOrderFileTicket(owner.orderId, { fileName: file.name, bytes: file.size })
          : await getDocumentFileTicket(owner.documentId, { fileName: file.name, bytes: file.size });
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }
      const t = ticket.ticket;
      const body = new FormData();
      body.append('file', file);
      for (const [key, value] of Object.entries(t.fields)) body.append(key, value);
      await cloudinaryPost(
        t.uploadUrl,
        body,
        setProgress,
      );
      setRegistrationIntentId(t.intentId);
      await finishRegistration(t.intentId);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace('الصورة', 'الملف') : 'تعذّر رفع الملف');
    } finally {
      setBusy(false);
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  const download = async (id: string) => {
    setError('');
    setDownloading(id);
    try {
      const link = await getPrivateFileLink(id);
      if (!link.ok) {
        setError(link.error);
        return;
      }
      window.location.assign(link.url);
    } catch {
      setError('تعذّر تجهيز التحميل — جرّب تاني');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 font-black text-slate-800">
        <Paperclip className="h-5 w-5 text-slate-500" aria-hidden="true" />
        {title}
      </h3>

      {loadError ? (
        <FormError message={loadError} />
      ) : files.length === 0 ? (
        <p className="text-sm font-medium text-slate-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <FileText className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800" dir="auto">{f.fileName}</p>
                <p className="text-xs font-medium text-slate-500">
                  {formatBytes(f.bytes)}
                  {' · '}
                  {f.uploadedByMe ? 'رفعته إنت' : f.fromProvider ? otherSideLabel : 'من العميل'}
                  {f.expiresAt && f.state === 'active' && (
                    <> · بيتمسح {new Date(f.expiresAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</>
                  )}
                </p>
              </div>
              {f.state === 'deleted' ? (
                <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                  {f.deletionReason === 'retention' ? 'اتمسح بعد انتهاء مدة الحفظ' : 'اتمسح'}
                </span>
              ) : f.state === 'delete_pending' ? (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                  الحذف قيد التنفيذ
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => download(f.id)}
                  disabled={downloading !== null}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {downloading === f.id ? 'جارٍ…' : 'تحميل'}
                </button>
              )}
              {f.state === 'active' && f.canDelete &&
                (confirming === f.id ? (
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      disabled={deleting !== null}
                      className="min-h-[40px] rounded-lg bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting === f.id ? 'جارٍ…' : 'متأكد؟ امسح'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      disabled={deleting !== null}
                      className="min-h-[40px] rounded-lg px-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
                    >
                      لأ
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(f.id)}
                    aria-label={`مسح ${f.fileName}`}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    مسح
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="mt-4 space-y-2">
          <input
            ref={input}
            type="file"
            accept={acceptAttr(rules.kinds)}
            className="sr-only"
            id={`files-${'orderId' in owner ? owner.orderId : owner.documentId}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
            disabled={busy || registrationIntentId !== null}
          />
          <label
            htmlFor={`files-${'orderId' in owner ? owner.orderId : owner.documentId}`}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 ${busy || registrationIntentId ? 'pointer-events-none opacity-60' : ''}`}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {busy ? `جارٍ الرفع${progress !== null ? ` ${progress}٪` : '…'}` : 'ارفع ملف'}
          </label>
          <p className="text-xs font-medium text-slate-500">
            {kindsLabel(rules.kinds)} · لحد {rules.maxMb} ميجا للملف.
          </p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-100">
            {retentionNotice(retentionDays, closedLabel)}
          </p>
        </div>
      )}

      <FormError message={error} className="mt-3" />
      {registrationIntentId && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void retryRegistration()}
            className="min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">
            {busy ? 'جارٍ حفظ الملف…' : 'إعادة محاولة حفظ الملف'}
          </button>
          <button type="button" disabled={busy}
            onClick={() => { setRegistrationIntentId(null); setError(''); }}
            className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-slate-700 disabled:opacity-50">
            اختيار ملف آخر
          </button>
        </div>
      )}
      {notice && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{notice}</p>}
    </section>
  );
}
