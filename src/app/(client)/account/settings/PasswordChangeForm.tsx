'use client';

import React, { useState } from 'react';
import { KeyRound, Lock, CheckCircle2 } from 'lucide-react';
import { setMyPassword } from '@/actions/set-password';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';

/**
 * تغيير كلمة المرور من إعدادات الحساب.
 *
 * ⚠️ **بتطلب الكلمة الحالية.** الجلسة وحدها مش إثبات كفاية: أي حد
 *    يلاقي الجهاز مفتوح كان يقدر يغيّرها ويقفل صاحب الحساب برّه
 *    حسابه — وده الإجراء الوحيد اللي بيخلّي الاستيلاء دائمًا.
 *
 * ⚠️ **والشرط متطبَّق في الأكشن لا هنا.** الخانة دي راحة للعين؛
 *    الحاجز الحقيقي على الخادم، لأن الأكشن ممكن يتنادى من غير
 *    الشاشة خالص (قاعدة «ع»).
 */
export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // الخانة اللي عليها الخطأ — الرسالة بتظهر تحتها بدل سطر الرسائل.
  const [errorField, setErrorField] = useState<string | undefined>();

  const fail = (text: string, field?: string) => {
    setMessage({ ok: false, text });
    setErrorField(field);
  };
  const err = (f: string) => (message && !message.ok && errorField === f ? message.text : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrorField(undefined);

    if (newPassword.length < 8) {
      fail('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل.', 'newPassword');
      return;
    }

    if (newPassword !== confirmPassword) {
      fail('كلمتا المرور غير متطابقتين.', 'confirmPassword');
      return;
    }

    setSaving(true);
    try {
      const res = await setMyPassword(newPassword, currentPassword);
      if (res.ok) {
        setMessage({ ok: true, text: 'تم تحديث كلمة المرور بنجاح!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        fail(res.error, res.field);
      }
    } catch {
      fail('تعذّر تحديث كلمة المرور. يرجى المحاولة لاحقاً.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-black text-slate-800 text-lg">أمان الحساب وكلمة المرور</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            يمكنك تعيين كلمة مرور جديدة لحسابك في أي وقت لحماية أمان بياناتك وطلباتك.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="كلمة المرور الحالية"
          name="currentPassword"
          required
          error={err('currentPassword')}
          hint={
            <>
              بنطلبها عشان حد يلاقي جهازك مفتوح ما يقدرش يغيّر كلمة مرورك.
              نسيتها؟{' '}
              <a href="/forgot-password" className="font-bold text-slate-800 underline">
                اطلب رابط استرجاع
              </a>
              .
            </>
          }
        >
          <TextInput
            type="password"
            dir="ltr"
            autoComplete="current-password"
            placeholder="كلمة مرورك دلوقتي"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="font-mono text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="كلمة المرور الجديدة" name="newPassword" required error={err('newPassword')}>
            <TextInput
              type="password"
              dir="ltr"
              minLength={8}
              placeholder="8 أحرف أو أرقام على الأقل"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="font-mono text-sm"
            />
          </Field>

          <Field label="تأكيد كلمة المرور الجديدة" name="confirmPassword" required error={err('confirmPassword')}>
            <TextInput
              type="password"
              dir="ltr"
              minLength={8}
              placeholder="أعد كتابة كلمة المرور"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="font-mono text-sm"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex-1">
            {message && !(errorField && !message.ok) && (
              <div
                className={`flex items-center gap-2 text-sm font-bold ${
                  message.ok ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl' : 'text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl'
                }`}
              >
                {message.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}
          </div>

          <BusyButton
            type="submit"
            busy={saving}
            disabled={!newPassword || !currentPassword}
          >
            <Lock className="h-4 w-4" />
            <span>تحديث كلمة المرور</span>
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
