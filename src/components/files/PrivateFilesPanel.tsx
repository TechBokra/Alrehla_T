'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Paperclip, Upload } from 'lucide-react';
import { cloudinaryPost } from '@/lib/cloudinary';
import {
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
import type { PrivateFileView } from '@/data/domains/private-files';
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
  const [downloading, setDownloading] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError('');
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
          ? await getOrderFileTicket(owner.orderId, file.name)
          : await getDocumentFileTicket(owner.documentId, file.name);
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }
      const t = ticket.ticket;
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', t.apiKey);
      body.append('timestamp', String(t.timestamp));
      body.append('signature', t.signature);
      body.append('folder', t.folder);
      body.append('type', t.type);
      body.append('allowed_formats', t.allowedFormats);
      const data = (await cloudinaryPost(
        `https://api.cloudinary.com/v1_1/${t.cloudName}/${t.resourceType}/upload`,
        body,
        setProgress,
      )) as { public_id?: string };
      if (!data.public_id) {
        setError('تعذّر رفع الملف — جرّب تاني');
        return;
      }
      const uploaded = { publicId: data.public_id, resourceType: t.resourceType, fileName: file.name };
      const saved =
        'orderId' in owner
          ? await registerOrderFile(owner.orderId, uploaded)
          : await registerDocumentFile(owner.documentId, uploaded);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      router.refresh();
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

      {files.length === 0 ? (
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
                  {f.expiresAt && !f.deleted && (
                    <> · بيتمسح {new Date(f.expiresAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</>
                  )}
                </p>
              </div>
              {f.deleted ? (
                <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                  اتمسح بعد انتهاء المدة
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
            disabled={busy}
          />
          <label
            htmlFor={`files-${'orderId' in owner ? owner.orderId : owner.documentId}`}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 ${busy ? 'pointer-events-none opacity-60' : ''}`}
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
    </section>
  );
}
