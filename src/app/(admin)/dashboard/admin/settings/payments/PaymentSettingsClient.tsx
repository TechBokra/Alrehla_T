'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, CreditCard, Wallet } from 'lucide-react';
import { Checkbox, Field, TextArea, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { savePaymentSettings, saveTransferDetails } from '@/actions/payments';
import { PaymentQrUploader } from './PaymentQrUploader';
import {
  METHOD_LABELS,
  PAYMENT_METHODS,
  PROVIDER_LABELS,
  type GatewayMethod,
  type PaymentProvider,
  type PaymentSettings,
} from '@/lib/payments/settings';

const UNEXPECTED = 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.';

/**
 * مفتاح التبديل بين بوابة الدفع والتحويل اليدوي.
 *
 * ⚠️ المفاتيح السرية مش هنا ولا في القاعدة — في متغيرات البيئة على
 *    Vercel. الشاشة دي بتقول بس إذا كانت موجودة ولا لأ.
 */
export function PaymentSettingsClient({
  settings,
  gatewayConfigured,
  walletNumber: savedWallet,
  qrUrl: savedQr,
}: {
  settings: PaymentSettings;
  gatewayConfigured: boolean;
  walletNumber: string;
  qrUrl: string;
}) {
  const [provider, setProvider] = useState<PaymentProvider>(settings.provider);
  const [methods, setMethods] = useState<GatewayMethod[]>(settings.methods);
  // بيتحفظ زي ما هو عشان نرجّعه لو البوابة سمحت بيه لاحقًا — مش بيتبعت دلوقتي.
  const [feesPassThrough] = useState(settings.feesPassThrough);
  const [downMessage, setDownMessage] = useState(settings.gatewayDownMessage);

  const [wallet, setWallet] = useState(savedWallet);
  const [qrUrl, setQrUrl] = useState(savedQr);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferErrorField, setTransferErrorField] = useState<string | undefined>();
  const [transferSaved, setTransferSaved] = useState(false);

  const saveTransfer = async () => {
    setTransferBusy(true);
    setTransferError('');
    setTransferErrorField(undefined);
    setTransferSaved(false);
    try {
      const result = await saveTransferDetails({ walletNumber: wallet, qrUrl: qrUrl || null });
      if (!result.ok) {
        setTransferError(result.error);
        setTransferErrorField(result.field);
        return;
      }
      setTransferSaved(true);
    } catch {
      setTransferError(UNEXPECTED);
    } finally {
      setTransferBusy(false);
    }
  };

  const toggleMethod = (m: GatewayMethod) =>
    setMethods((current) =>
      current.includes(m) ? current.filter((x) => x !== m) : [...current, m],
    );

  const save = async () => {
    setBusy(true);
    setError('');
    setErrorField(undefined);
    setSaved(false);
    try {
      const result = await savePaymentSettings({
        provider,
        methods,
        feesPassThrough,
        gatewayDownMessage: downMessage,
      });
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      setSaved(true);
    } catch {
      setError(UNEXPECTED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      {!errorField && <FormError message={error} className="mb-2" />}

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <Check className="h-4 w-4" aria-hidden="true" />
          {provider === 'xpay'
            ? 'تم الحفظ — العملاء بيدفعوا بالبطاقة دلوقتي.'
            : 'تم الحفظ — العملاء بيدفعوا بالتحويل اليدوي دلوقتي.'}
        </div>
      )}

      {!gatewayConfigured && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">مفاتيح XPay مش موجودة على الخادم.</p>
            <p className="mt-1 leading-relaxed">
              ضيف <code className="rounded bg-amber-100 px-1" dir="ltr">XPAY_SECRET_KEY</code> و
              <code className="mr-1 rounded bg-amber-100 px-1" dir="ltr">XPAY_WEBHOOK_SECRET</code>{' '}
              في إعدادات المشروع على Vercel وأعد النشر. لحد ما ده يحصل، البوابة مش هتشتغل
              حتى لو اخترتها هنا.
            </p>
          </div>
        </div>
      )}

      <fieldset>
        <legend className="mb-3 block text-sm font-bold text-slate-700">
          طريقة الدفع المعروضة للعميل
        </legend>
        <div className="space-y-3">
          {(['xpay', 'manual'] as const).map((p) => (
            <label
              key={p}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                provider === p ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => setProvider(p)}
                className="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="flex items-center gap-2 font-bold text-slate-800">
                  {p === 'xpay' ? (
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                  )}
                  {PROVIDER_LABELS[p]}
                </span>
                <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">
                  {p === 'xpay'
                    ? 'العميل يدفع فورًا والطلب يتأكد لوحده. مفيش مراجعة إيصالات.'
                    : 'العميل يحوّل ويرفع إيصال، والإدارة تراجعه وتأكد الدفع.'}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errorField === 'provider' && (
          <p className="mt-2 text-xs font-bold text-red-600">{error}</p>
        )}
      </fieldset>

      {provider === 'xpay' && (
        <>
          <fieldset>
            <legend className="mb-2 block text-sm font-bold text-slate-700">
              وسائل الدفع المعروضة في البوابة
            </legend>
            <p className="mb-3 text-xs font-medium leading-relaxed text-slate-500">
              علّم بس على اللي <strong>مفعّل فعلًا</strong> في حساب XPay (الإعدادات ← طرق
              الدفع). لو علّمت على وسيلة مش مفعّلة عندهم، الموقع بيتجاهل اختيارك ويعرض
              الوسائل المفعّلة في حسابك بدل ما يوقف الدفع على العميل.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {PAYMENT_METHODS.map((m) => (
                <Checkbox
                  key={m}
                  label={METHOD_LABELS[m]}
                  checked={methods.includes(m)}
                  onChange={() => toggleMethod(m)}
                />
              ))}
            </div>
            {errorField === 'methods' && (
              <p className="mt-2 text-xs font-bold text-red-600">{error}</p>
            )}
          </fieldset>

          {/* ⚠️ الرسوم والضريبة مابيتبعتوش من هنا: البوابة بترفض الطلب لو
              الكائن ناقص، وتحديد تحصيل الضريبة قرار مالي مكانه حسابك
              عندهم مش كود الموقع. */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">الرسوم والضريبة:</span> بتتحدد من حسابك
            في XPay (الإعدادات ← الرسوم والضريبة)، مش من هنا. قرارك الحالي إن الموقع
            بيتحمّل الرسوم والعميل بيدفع السعر المعلن — اتأكد إن ده نفس الإعداد عندهم.
          </div>
        </>
      )}

      <Field
        label="رسالة تظهر للعميل لو البوابة وقعت"
        name="gatewayDownMessage"
        hint="تظهر لما تكون البوابة مختارة لكن مفاتيحها ناقصة على الخادم. سيبها فاضية للرسالة الافتراضية."
        error={errorField === 'gatewayDownMessage' ? error : undefined}
      >
        <TextArea
          rows={2}
          value={downMessage}
          onChange={(e) => setDownMessage(e.target.value)}
          placeholder="الدفع بالبطاقة متوقف مؤقتًا — يمكنك الدفع بالتحويل."
        />
      </Field>

      <div className="flex justify-end border-t border-slate-100 pt-6">
        <BusyButton busy={busy} onClick={save} className="px-8">
          حفظ إعدادات البوابة
        </BusyButton>
      </div>

      {/* ──────────── التحويل اليدوي ──────────── */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
            <Wallet className="h-5 w-5" aria-hidden="true" /> استقبال التحويلات
          </h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
            الرقم والكود دول بيظهروا للعميل في كل شاشات الدفع بالتحويل، سواء كانت البوابة
            مقفولة أو وقعت. راجعهم كويس — ده الحساب اللي بتوصله فلوس العملاء.
          </p>
        </div>

        {transferSaved && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            <Check className="h-4 w-4" aria-hidden="true" /> تم حفظ بيانات التحويل.
          </div>
        )}
        {!transferErrorField && <FormError message={transferError} />}

        <Field
          label="رقم المحفظة (إنستاباي / فودافون كاش)"
          name="walletNumber"
          required
          error={transferErrorField === 'walletNumber' ? transferError : undefined}
        >
          <TextInput
            dir="ltr"
            className="text-left"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
          />
        </Field>

        <PaymentQrUploader value={qrUrl} walletNumber={wallet} onSaved={setQrUrl} />

        <div className="flex justify-end">
          <BusyButton busy={transferBusy} onClick={saveTransfer} className="px-8">
            حفظ بيانات التحويل
          </BusyButton>
        </div>
      </section>
    </div>
  );
}
