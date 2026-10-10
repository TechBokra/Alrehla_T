'use client';

import React, { useState } from 'react';
import { useNow } from '@/components/providers/ClientTimeProvider';
import { ageAtTime } from '@/lib/time-values';
import { useRouter } from 'next/navigation';
import { Send, Package, CheckCircle2, Play, Truck, AlertCircle, Lock } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import type { ServiceOrderRow, ServiceOrderMessage } from '@/data/domains/services';
import {
  sendServiceOrderMessage,
  startServiceOrder,
  deliverServiceOrder,
  confirmServiceOrderReceipt,
  confirmServiceOrderPayment,
  closeServiceOrderByAdmin,
  setServiceOrderStatusByAdmin,
  setServiceOrderDueDate,
  type ServiceOrderResult,
} from '@/actions/service-orders';
import { Field, TextArea, TextInput } from '@/components/forms/Form';
import {
  SERVICE_DUE_DAYS,
  dueLabel,
  isOverdue,
  OPEN_SERVICE_STATUSES,
} from '@/lib/service-delivery';

export type OrderViewer = 'customer' | 'instructor' | 'admin';

interface Props {
  order: ServiceOrderRow;
  messages: ServiceOrderMessage[];
  viewer: OrderViewer;
  /** The signed-in user's profile id, to align their own messages. */
  currentProfileId: string;
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'بانتظار الدفع', className: 'bg-slate-100 text-slate-600' },
  awaiting_verification: {
    label: 'بانتظار تأكيد الدفع',
    className: 'bg-amber-100 text-amber-700',
  },
  paid: { label: 'مدفوع — بانتظار بدء المدرب', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'جاري التنفيذ', className: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'تم التسليم — بانتظار تأكيدك', className: 'bg-violet-100 text-violet-700' },
  completed: { label: 'مكتمل', className: 'bg-emerald-100 text-emerald-700' },
  refunded: { label: 'مسترجع', className: 'bg-slate-200 text-slate-600' },
  cancelled: { label: 'ملغي', className: 'bg-slate-200 text-slate-600' },
};

const STEPS = ['paid', 'in_progress', 'delivered', 'completed'] as const;
const STEP_LABELS: Record<string, string> = {
  paid: 'مدفوع',
  in_progress: 'جاري التنفيذ',
  delivered: 'تم التسليم',
  completed: 'مكتمل',
};

/**
 * الخطأ بيظهر **في نفس الكارت** اللي اتداس فيه الزرار — المحادثة تحت
 * والإجراءات فوق، ورسالة واحدة أعلى الصفحة كانت بتتشاف بالعافية.
 */
type ErrorScope = 'actions' | 'chat';
type ActionError = { scope: ErrorScope; message: string; field?: string };

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
    >
      {message}
    </div>
  );
}

const btnBase =
  'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50';

/** السن بالسنين من تاريخ الميلاد — «9 سنة» أوضح من تاريخ خام. */
function childAge(birthDate: string, now: number): string {
  const years = ageAtTime(birthDate, now);
  return years !== null && years > 0 ? `${years} سنة` : '';
}

export function ServiceOrderDetail({ order, messages, viewer, currentProfileId }: Props) {
  const now = useNow();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [draft, setDraft] = useState('');
  const [deliveryDraft, setDeliveryDraft] = useState('');
  const [showDelivery, setShowDelivery] = useState(false);
  const [adminReason, setAdminReason] = useState('');
  const [adminAction, setAdminAction] = useState<'close' | 'refunded' | 'cancelled' | null>(null);

  const status = STATUS[order.status] ?? { label: order.status, className: 'bg-slate-100' };
  const isClosed = ['completed', 'refunded', 'cancelled'].includes(order.status);
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  /**
   * ⚠️ العمليات **بترجّع** `{ ok: false, error }` مش بترمي (قاعدة «هـ»)،
   *    فلازم نقرا `ok` — من غير كده الفشل كان هيعدّي كأنه نجاح ويمسح
   *    المسودة. الـ`catch` فاضل لعطل الشبكة بس.
   */
  const run = async (scope: ErrorScope, fn: () => Promise<ServiceOrderResult>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (!result.ok) {
        // المسودة بتفضل زي ما هي عشان يصلّح ويبعت تاني.
        setError({ scope, message: result.error, field: result.field });
        return;
      }
      setDraft('');
      setDeliveryDraft('');
      setShowDelivery(false);
      setAdminAction(null);
      setAdminReason('');
      router.refresh();
    } catch {
      setError({ scope, message: 'حدث خطأ غير متوقع — جرّب تاني' });
    } finally {
      setBusy(false);
    }
  };

  const actionsError = error?.scope === 'actions' ? error : null;
  const chatError = error?.scope === 'chat' ? error : null;
  /** خطأ الخانة دي بالذات (لو العملية رجّعت `field`). */
  const fieldError = (field: string) =>
    actionsError?.field === field ? actionsError.message : undefined;

  const daysSinceDelivery = order.deliveredAt
    ? Math.floor((now - new Date(order.deliveredAt).getTime()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6">

      {/* Summary */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-black text-slate-800">{order.serviceName}</h2>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">
              طلب {order.paymentReference ?? `#${order.id.slice(0, 8)}`} ·{' '}
              {formatDate(order.createdAt)}
              {order.providerName && ` · مقدّم الخدمة: ${order.providerName}`}
            </p>

            {/*
              المستفيد. الطلب كان بيتسجّل باسم المشتري وبس، فمقدّم الخدمة
              ينفّذ شغل مايعرفش هو لمين — والسن بيغيّر المحتوى نفسه في
              خدمة تربوية للأطفال.
            */}
            {order.participantType === 'child' && order.participantName && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                المستفيد: {order.participantName}
                {order.participantBirthDate && ` · ${childAge(order.participantBirthDate, now)}`}
              </p>
            )}
          </div>
          <div className="text-left">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
            >
              {status.label}
            </span>
            <p className="mt-2 text-2xl font-black text-slate-800">{formatPrice(order.amount)}</p>
            {viewer !== 'customer' && order.instructorEarning != null && (
              <p className="text-xs font-bold text-slate-400">
                حصيلة مقدّم الخدمة: {formatPrice(order.instructorEarning)}
              </p>
            )}
            {viewer !== 'customer' && order.providerKind === 'platform' && (
              <p className="text-xs font-bold text-slate-400">
                المنصة هي مقدّم الخدمة — لا مستحق يُدفع
              </p>
            )}
          </div>
        </div>

        {/* المهلة — بتظهر للتلاتة، وبتتعدّل من الإدارة وحدها. */}
        {(OPEN_SERVICE_STATUSES as readonly string[]).includes(order.status) && (
          <DuePanel order={order} viewer={viewer} />
        )}

        {/* Progress */}
        {!['refunded', 'cancelled'].includes(order.status) && (
          <div className="mt-6 flex items-center gap-1">
            {STEPS.map((step, i) => {
              const done = stepIndex >= i;
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        done ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`mb-5 h-0.5 flex-1 ${
                        stepIndex > i ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isClosed && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-black text-slate-800">الإجراء التالي</h3>

          {/* خطأ الخانة بيظهر تحتها؛ الباقي هنا. */}
          {actionsError && !actionsError.field && <ErrorBox message={actionsError.message} />}

          {viewer === 'instructor' && order.status === 'paid' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run('actions', () => startServiceOrder(order.id))}
              className={`${btnBase} bg-indigo-600 text-white hover:bg-indigo-700`}
            >
              <Play className="h-4 w-4" /> بدأت التنفيذ
            </button>
          )}

          {viewer === 'instructor' &&
            (order.status === 'in_progress' || order.status === 'paid') && (
              <div className="mt-3">
                {!showDelivery ? (
                  <button
                    type="button"
                    onClick={() => setShowDelivery(true)}
                    className={`${btnBase} bg-violet-600 text-white hover:bg-violet-700`}
                  >
                    <Truck className="h-4 w-4" /> تسليم العمل
                  </button>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <Field
                      label="رسالة التسليم"
                      name="deliveryMessage"
                      required
                      hint="اكتب ما الذي سلّمته وأين يجده العميل. لا يمكن تسجيل التسليم بدونها."
                      error={fieldError('deliveryMessage')}
                    >
                      <TextArea
                        rows={4}
                        value={deliveryDraft}
                        onChange={(e) => setDeliveryDraft(e.target.value)}
                        className="resize-none text-sm font-medium"
                        placeholder="مثال: أرفقت المراجعة الكاملة على الرابط التالي… ركّزت على بناء الشخصيات والحوار."
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDelivery(false)}
                        className={`${btnBase} border border-slate-200 bg-white text-slate-600`}
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run('actions', () => deliverServiceOrder(order.id, deliveryDraft))}
                        className={`${btnBase} bg-violet-600 text-white hover:bg-violet-700`}
                      >
                        <Truck className="h-4 w-4" /> تأكيد التسليم
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          {viewer === 'customer' && order.status === 'delivered' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-600">
                راجع ما سلّمه المدرب في المحادثة بالأسفل، وأكّد الاستلام عندما تطمئن.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => run('actions', () => confirmServiceOrderReceipt(order.id))}
                className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}
              >
                <CheckCircle2 className="h-4 w-4" /> استلمت العمل
              </button>
            </div>
          )}

          {viewer === 'admin' && order.status === 'awaiting_verification' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run('actions', () => confirmServiceOrderPayment(order.id))}
              className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <CheckCircle2 className="h-4 w-4" /> تأكيد استلام المبلغ
            </button>
          )}

          {viewer === 'admin' && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {order.status === 'delivered' && daysSinceDelivery != null && (
                <p className="flex items-start gap-1.5 text-sm font-bold text-amber-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  مضى {daysSinceDelivery} يوم على التسليم بدون تأكيد من العميل.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {order.status === 'delivered' && (
                  <button
                    type="button"
                    onClick={() => setAdminAction(adminAction === 'close' ? null : 'close')}
                    className={`${btnBase} border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
                  >
                    <Lock className="h-4 w-4" /> إقفال الطلب
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAdminAction(adminAction === 'refunded' ? null : 'refunded')}
                  className={`${btnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  استرجاع
                </button>
                <button
                  type="button"
                  onClick={() => setAdminAction(adminAction === 'cancelled' ? null : 'cancelled')}
                  className={`${btnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  إلغاء الطلب
                </button>
              </div>

              {adminAction && (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Field
                    label="السبب (يُسجَّل في سجل التدقيق)"
                    name="reason"
                    required
                    error={fieldError('reason')}
                  >
                    <TextInput
                      className="text-base md:text-sm"
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                    />
                  </Field>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run('actions', () =>
                          adminAction === 'close'
                            ? closeServiceOrderByAdmin(order.id, adminReason)
                            : setServiceOrderStatusByAdmin(order.id, adminAction, adminReason)
                        )
                      }
                      className={`${btnBase} bg-slate-900 text-white hover:bg-slate-800`}
                    >
                      تأكيد
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {viewer === 'customer' &&
            !['delivered'].includes(order.status) &&
            order.status !== 'completed' && (
              <p className="text-sm font-medium text-slate-500">
                لا يوجد إجراء مطلوب منك الآن. ستجد تحديثات المدرب في المحادثة بالأسفل.
              </p>
            )}

          {viewer === 'instructor' &&
            ['pending', 'awaiting_verification', 'delivered'].includes(order.status) && (
              <p className="text-sm font-medium text-slate-500">
                {order.status === 'delivered'
                  ? 'سلّمت العمل — بانتظار تأكيد العميل.'
                  : 'لا يمكن بدء التنفيذ قبل أن تؤكد الإدارة استلام المبلغ.'}
              </p>
            )}
        </div>
      )}

      {/* Conversation */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-black text-slate-800">المحادثة</h3>
        <p className="mb-5 text-sm font-medium text-slate-500">
          {viewer === 'admin'
            ? 'المحادثة بين العميل والمدرب — سجل لا يُعدَّل ولا يُحذف.'
            : 'الرسائل سجل دائم للطلب. الإدارة تستطيع الاطلاع عليها عند الحاجة.'}
        </p>

        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="py-8 text-center font-medium text-slate-400">لا توجد رسائل بعد.</p>
          )}

          {messages.map((m) => {
            const mine = m.senderProfileId === currentProfileId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    m.isDelivery
                      ? 'border border-violet-200 bg-violet-50'
                      : mine
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-slate-50'
                  }`}
                >
                  <div
                    className={`mb-1 flex items-center gap-2 text-xs font-bold ${
                      mine && !m.isDelivery ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    <span>{mine ? 'أنت' : m.senderName}</span>
                    <span>·</span>
                    <span>{formatDate(m.createdAt)}</span>
                    {m.isDelivery && (
                      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-white">
                        رسالة التسليم
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm leading-relaxed font-medium whitespace-pre-wrap ${
                      mine && !m.isDelivery ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {m.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          {chatError && <ErrorBox message={chatError.message} />}
          <div className="flex gap-2">
            <TextArea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="اكتب رسالة…"
              aria-label="رسالة جديدة"
              aria-invalid={chatError?.field === 'body' || undefined}
              className="flex-1 resize-none text-sm font-medium"
            />
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => run('chat', () => sendServiceOrderMessage(order.id, draft))}
              className={`${btnBase} shrink-0 self-end bg-slate-900 text-white hover:bg-slate-800`}
            >
              <Send className="h-4 w-4" /> إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * مهلة التسليم.
 *
 * الطرفين بيشوفوا نفس الرقم ونفس السبب. الإدارة وحدها بتغيّره — لأن
 * المهلة التزام تجاه العميل، ومقدّم الخدمة ما ينفعش يمدّها لنفسه.
 */
function DuePanel({
  order,
  viewer,
}: {
  order: ServiceOrderRow;
  viewer: OrderViewer;
}) {
  const now = useNow();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(order.dueAt ? order.dueAt.slice(0, 10) : '');
  const [note, setNote] = useState(order.dueNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<string | undefined>();

  const late = isOverdue(order.dueAt, new Date(now));

  const save = async () => {
    setBusy(true);
    setError('');
    setErrorField(undefined);
    try {
      const result = await setServiceOrderDueDate(order.id, date || null, note);
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('تعذّر الحفظ — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`mt-4 rounded-2xl border p-4 ${
        late ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`font-bold ${late ? 'text-red-700' : 'text-slate-700'}`}>
            مهلة التسليم: {dueLabel(order.dueAt, new Date(now))}
          </p>
          {order.dueNote ? (
            <p className="mt-1 text-sm font-medium text-slate-500">{order.dueNote}</p>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-400">
              المهلة الطبيعية {SERVICE_DUE_DAYS} يومًا من تأكيد الدفع.
            </p>
          )}
        </div>

        {viewer === 'admin' && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            تعديل المهلة
          </button>
        )}
      </div>

      {viewer === 'admin' && editing && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Field
              label="المهلة الجديدة"
              name="dueAt"
              error={errorField === 'dueAt' ? error : undefined}
            >
              <TextInput
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm font-bold"
              />
            </Field>
            <Field
              label="سبب التغيير"
              name="note"
              hint="بيظهر للطرفين"
              className="min-w-[220px] flex-1"
              error={errorField === 'note' ? error : undefined}
            >
              <TextInput
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="سبب التغيير — بيظهر للطرفين"
                className="text-sm"
              />
            </Field>
          </div>
          {error && !errorField && (
            <p role="alert" className="text-sm font-bold text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={save}
              className="rounded-xl bg-slate-800 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              حفظ
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
