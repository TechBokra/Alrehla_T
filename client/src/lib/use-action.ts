'use client';

import { useCallback, useState } from 'react';

/**
 * نداء أكشن خادم بحالة انتظار ورسالة خطأ — في مكان واحد.
 *
 * ── المشكلة اللي بيحلّها ────────────────────────────────────
 *
 * أكتر شكوى متكررة على الموقع: «الزر مبيعملش حاجة». والسبب مش إن
 * الضغطة ضاعت، السبب إن الشاشة **مبتقولش** إنها استلمتها. وده بيحصل
 * بتلات طرق مختلفة في المشروع:
 *
 *   ١. الأكشن **بيرمي**، والمكوّن مالوش `try/catch` — الاستثناء
 *      بيطلع لحدود React، والمستخدم بيشوف شاشة خطأ عامة أو ولا حاجة.
 *      وNext بيخفي نص الخطأ في النسخة المنشورة أصلًا (قاعدة «هـ»).
 *
 *   ٢. الأكشن **بيرجّع** `{ ok: false, error }`، والمكوّن بيرمي
 *      النتيجة في الزبالة — فالفشل بيعدّي كأنه نجاح.
 *
 *   ٣. مفيش حالة انتظار، فالمستخدم بيدوس تاني وتالت والطلب بيتبعت
 *      مرتين وتلاتة.
 *
 * الخطاف ده بيغطّي التلاتة: بيمسك الرمي، بيقرا شكل النتيجة، وبيقفل
 * الزر وهو شغّال.
 *
 * ── الاستعمال ───────────────────────────────────────────────
 *
 *     const save = useAction(updateMyProfile);
 *     ...
 *     <FormError message={save.error} />
 *     <Button pending={save.pending} onClick={() => save.run(data)}>حفظ</Button>
 *
 * و`run` بترجّع النتيجة لو نجحت و`undefined` لو فشلت، فالمكوّن يقدر
 * يكمّل بعد النجاح:
 *
 *     const result = await save.run(data);
 *     if (result) router.push('/done');
 *
 * ⚠️ **ده مش بديل عن إصلاح الأكشن نفسه.** الأكشن اللي بيرمي بيوصل
 *    للمستخدم برسالة عامة، لأن Next بيمسح النص الأصلي في الإنتاج.
 *    الحل الكامل إن الأكشن يرجّع `{ ok, error }` (قاعدة «هـ»)،
 *    والخطاف ده بيقرا الشكل ده لوحده. لحد ما ده يحصل، المستخدم على
 *    الأقل **بيعرف إن في حاجة وقعت** بدل ما يفضل مستني.
 */

const FALLBACK = 'حصلت مشكلة ومكملناش. جرّب تاني، ولو فضلت كلّمنا.';

/**
 * أخطاء **التحكّم** في Next — مش أعطال.
 *
 * ⚠️ **دي أخطر نقطة في الملف كله.**
 *
 * `redirect()` و`notFound()` في Next بيشتغلوا برمي استثناء مخصوص.
 * يعني الأكشن اللي بينجح وبيودّي المستخدم لصفحة تانية **بيرمي**،
 * وأي `catch` شامل بيبلعه — فالنتيجة إن العملية نجحت، والانتقال
 * اتمنع، والمستخدم شاف رسالة «حصلت مشكلة» على عملية تمّت فعلًا.
 *
 * ودي أسوأ من العطل اللي بنصلّحه: رسالة خطأ كاذبة على نجاح بتخلّي
 * المستخدم يعيد العملية — يعني طلب مكرر أو دفعة تانية.
 *
 * عشان كده الاستثناءات دي بتتعاد رميها زي ما هي، وNext يكمّل شغله.
 * التمييز بيتم بـ`digest` اللي Next بيحطها على الاستثناء.
 */
export function isControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  if (typeof digest !== 'string') return false;
  return (
    digest.startsWith('NEXT_REDIRECT') ||
    digest.startsWith('NEXT_NOT_FOUND') ||
    digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')
  );
}

/**
 * بيقرا شكل النتيجة ويطلّع رسالة الخطأ لو فيه.
 *
 * مصدَّرة عشان تتّاختبر من غير React — المشروع مفيهوش
 * `@testing-library/react`، فالمنطق اللي يستاهل اختبارًا بيتحط هنا
 * برّه الخطاف.
 */
export function actionErrorOf(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;

  // `ok: true` أو `success: true` = نجاح صريح.
  if (r.ok === true || r.success === true) return null;

  if (r.ok === false || r.success === false) {
    const message = typeof r.error === 'string' ? r.error.trim() : '';
    return message || FALLBACK;
  }

  // الشكل التالت: `{ error }` لوحده بلا `ok` ولا `success`.
  // ⚠️ ده شكل حقيقي في المشروع مش احتمال نظري — `signIn` و`signUp`
  //    في `actions/auth.ts` بيرجّعوا كده. ولو مااتقراش هنا، فشل تسجيل
  //    الدخول كان هيعدّي كأنه نجاح.
  if (r.ok === undefined && r.success === undefined && typeof r.error === 'string') {
    return r.error.trim() || FALLBACK;
  }

  // أي شكل تاني (الأكشن رجّع بيانات أو undefined) = نجاح.
  return null;
}

export type UseActionReturn<Args extends unknown[], R> = {
  /** ينفّذ الأكشن. بيرجّع النتيجة لو نجح، و`undefined` لو وقع أو رجّع فشلًا. */
  run: (...args: Args) => Promise<R | undefined>;
  /** الأكشن شغّال دلوقتي — اربطها بـ`pending` بتاع الزر. */
  pending: boolean;
  /** رسالة الخطأ للعرض، أو نص فاضي. */
  error: string;
  /** الخانة اللي الخطأ عليها (`field` في نتيجة الأكشن) — للعرض تحتها. */
  errorField?: string;
  /** لمسح الرسالة (مثلًا أول ما المستخدم يعدّل الحقل). */
  clearError: () => void;
};

export function useAction<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  options: {
    /** يتنفّذ بعد النجاح وحده. */
    onSuccess?: (result: R) => void;
    /** رسالة بديلة لما الأكشن يرمي بلا نص مفهوم. */
    fallbackError?: string;
  } = {},
): UseActionReturn<Args, R> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<string | undefined>();

  const { onSuccess, fallbackError = FALLBACK } = options;

  const run = useCallback(
    async (...args: Args): Promise<R | undefined> => {
      setPending(true);
      setError('');
      setErrorField(undefined);
      try {
        const result = await fn(...args);

        const failure = actionErrorOf(result);
        if (failure) {
          setError(failure);
          const field = (result as { field?: unknown } | null)?.field;
          setErrorField(typeof field === 'string' ? field : undefined);
          return undefined;
        }

        onSuccess?.(result);
        return result;
      } catch (err) {
        // الانتقال والـ404 مش أعطال — تعدّي زي ما هي وNext يكمّل.
        if (isControlFlowError(err)) throw err;

        // ⚠️ النص اللي بيوصل هنا في الإنتاج **مش** نص الخطأ الأصلي:
        //    Next بيستبدله برسالة إنجليزية عامة. فبنفضّل رسالتنا
        //    العربية إلا لو الرسالة بتبان عربية فعلًا.
        const raw = err instanceof Error ? err.message.trim() : '';
        const looksArabic = /[؀-ۿ]/.test(raw);
        setError(looksArabic ? raw : (staleOrOffline(raw) ?? fallbackError));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn, onSuccess, fallbackError],
  );

  const clearError = useCallback(() => {
    setError('');
    setErrorField(undefined);
  }, []);

  return { run, pending, error, errorField, clearError };
}

/**
 * أعطال مش من العملية نفسها — ليها رسالة أوضح من «تعذّر الحفظ».
 *
 * ⚠️ **الصفحة القديمة** (#ARWL في اختبار الإدارة): لو الصفحة مفتوحة من
 *    قبل ما نسخة جديدة من الموقع تنزل، الزرار بينادي عملية مابقتش
 *    موجودة على الخادم. التحديث بيحلّها — فبنقول كده بدل رسالة عامة.
 */
export function staleOrOffline(message: string): string | null {
  if (/server action|failed to find/i.test(message)) {
    return 'الصفحة دي قديمة (نزلت نسخة جديدة من الموقع) — حدّث الصفحة وجرّب تاني.';
  }
  if (/failed to fetch|network|load failed/i.test(message)) {
    return 'الاتصال بالإنترنت اتقطع — جرّب تاني.';
  }
  return null;
}
