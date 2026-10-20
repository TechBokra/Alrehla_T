'use client';

import { PHONE_INPUT_PROPS } from '@/lib/phone';
import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { submitSupportSessionRequest } from '@/actions/support';
import { useAction } from '@/lib/use-action';
import { FormError } from '@/components/ui/FormError';
import { Field, TextInput, TextArea, BusyButton } from '@/components/forms/Form';

export function SessionRequestForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * ⚠️ الشكل اللي كان هنا:
   *
   *     setIsSubmitting(true);
   *     await submitSupportSessionRequest(...);   // بلا try
   *     setIsSubmitting(false);
   *     setIsSuccess(true);
   *
   * وde أسوأ من الزر الصامت: الأكشن ده **بيرمي** لما الصلاحيات ترفض
   * أو الشبكة تقع. والرمي بيوقف السطرين اللي بعده — يعني
   * `setIsSubmitting(false)` **مبيتنفّذش أبدًا**، فالزر بيفضل مقفولًا
   * على «جاري الإرسال...» **للأبد**. النموذج بيتعلّق ومفيش أي رسالة.
   *
   * وفي الحالة العكسية كان أخطر: لو الأكشن رجع بلا ما يكتب حاجة،
   * `setIsSuccess(true)` بتتنفّذ على طول — فالمستخدم بيشوف «تم إرسال
   * طلبك بنجاح» على طلب ما وصلش.
   */
  const submit = useAction(submitSupportSessionRequest, {
    onSuccess: () => {
      setIsSuccess(true);
      setName('');
      setPhone('');
      setMessage('');
    },
    fallbackError: 'تعذّر إرسال طلبك. جرّب تاني، ولو فضلت كلّمنا على واتساب.',
  });

  const err = (f: string) => (submit.errorField === f ? submit.error : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit.run(name, phone, message);
  };

  if (isSuccess) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-800 shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
        <h3 className="mb-2 text-xl font-black">تم إرسال طلبك بنجاح!</h3>
        <p className="text-emerald-700">سيتواصل معك فريق الدعم في أقرب وقت لمساعدتك في استكمال الحجز.</p>
        <button 
          onClick={() => setIsSuccess(false)}
          className="mt-6 rounded-xl bg-emerald-600 px-6 py-2 font-bold text-white hover:bg-emerald-700"
        >
          إرسال طلب آخر
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      {/* الخطأ اللي على خانة بعينها بيظهر تحتها؛ الباقي هنا. */}
      <FormError message={submit.errorField ? '' : submit.error} />

      <div className="space-y-4">
        <Field label="الاسم الكريم" name="contactName" required error={err('contactName')}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اكتب اسمك هنا"
          />
        </Field>
        <Field label="رقم الهاتف (للتواصل)" name="contactPhone" required error={err('contactPhone')}>
          <TextInput
            {...PHONE_INPUT_PROPS}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="text-left"
            placeholder="مثال: 01000000000"
          />
        </Field>
        <Field label="كيف يمكننا مساعدتك في الحجز؟" name="message" required error={err('message')}>
          <TextArea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب استفسارك أو المشكلة التي تواجهها هنا..."
          />
        </Field>
      </div>
      <BusyButton type="submit" busy={submit.pending} pendingLabel="جاري الإرسال..." className="w-full">
        <Send className="h-5 w-5" />
        إرسال الطلب
      </BusyButton>
    </form>
  );
}
