import React from 'react';
import Link from 'next/link';

/**
 * الزر — أول مكوّن بيستهلك طبقة الرموز.
 *
 * ── إيه اللي اتغيّر ─────────────────────────────────────────
 *
 * **ولا حاجة في الشكل.** كل صنف لوني اتبدّل برمز بيشاور على **نفس**
 * لون Tailwind اللي كان مكتوب:
 *   bg-amber-500 → bg-brand          (var(--color-amber-500))
 *   bg-rose-500  → bg-enha-lak       (var(--color-rose-500))
 *   bg-emerald-500 → bg-journey      (var(--color-emerald-500))
 *   rounded-xl   → rounded-control   (0.75rem — نفس القيمة)
 *
 * المكسب إن تغيير لون الهوية بقى سطر في `globals.css` بدل ما يكون
 * تعديل في كل ملف بيستخدم لونًا.
 *
 * ── الأسماء القديمة لسه شغّالة ──────────────────────────────
 *
 * `accentColor` بتقبل الاسم الدلالي الجديد (`brand`/`enhaLak`/`journey`)
 * **والاسم اللوني القديم** (`amber`/`rose`/`emerald`). عشان كده مفيش
 * ولا موضع نداء محتاج يتغيّر دلوقتي — الترحيل بيحصل عند لمس كل ملف.
 *
 * ⚠️ **الجديد يستخدم الاسم الدلالي.** الاسم اللوني بيربط الكود بلون
 *    بعينه، وده بالظبط اللي بنخرج منه.
 */

/** الاسم الدلالي — ده اللي يتكتب في أي كود جديد. */
type Accent = 'brand' | 'enhaLak' | 'journey';
/** الاسم اللوني القديم — باقٍ للتوافق مع مواضع النداء الحالية. */
type LegacyAccent = 'amber' | 'rose' | 'emerald';

const ACCENT_ALIAS: Record<LegacyAccent, Accent> = {
  amber: 'brand',
  rose: 'enhaLak',
  emerald: 'journey',
};

type ButtonProps = {
  /**
   * `neutral` = الزر الداكن (أسود/رمادي غامق بنص أبيض).
   *
   * ⚠️ **اتضافت عشان عطل حقيقي.** مواضع كتير كانت بتكتب
   *    `className="!bg-slate-900"` عشان تعمل زرًا داكنًا — بتتجاوز
   *    الخلفية **وتسيب لون النص للمكوّن**. ولما المرحلة ١ خلّت النص
   *    داكنًا (`text-brand-ink` = slate-900)، النتيجة بقت:
   *
   *      خلفية slate-900 + نص slate-900 = **نص مختفي تمامًا** (1:1)
   *
   *    وده اللي حصل فعلًا لزر «تصفح المدونة» على الموقع المنشور.
   *
   *    الدرس: أي تجاوز للخلفية لازم يتجاوز النص معاه — وأحسن منه إن
   *    الشكل يبقى **نسخة معرَّفة في المكوّن** بدل `!important` في
   *    موضع النداء.
   */
  variant?: 'primary' | 'secondary' | 'neutral';
  accentColor?: Accent | LegacyAccent;
  size?: 'md' | 'lg';
  href?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /**
   * الزر بينفّذ دلوقتي.
   *
   * ── ليه الخاصية دي موجودة ───────────────────────────────
   *
   * أكتر شكوى متكررة على الموقع: «الزر مبيعملش حاجة». والسبب مش إن
   * الضغطة ضاعت — السبب إن الشاشة **مبتقولش** إنها استلمتها. الزر
   * بيفضل شكله هو هو سواء الطلب شغّال، أو خلص، أو وقع في تحقق.
   *
   * `pending` بتقفل الزر، بتدوّر مؤشرًا، وبتكتب `aria-busy` للقارئ
   * الصوتي. و`pendingText` بتقول إيه اللي بيحصل بالظبط.
   *
   * ⚠️ الحالة دي **مش بديل عن رسالة الخطأ**. الضغطة اللي بتفشل في
   *    التحقق لازم تطلّع سببًا مكتوبًا — الدوران لوحده بيسيب المستخدم
   *    مستني حاجة مش جاية.
   */
  pending?: boolean;
  /** النص اللي يتعرض وقت التنفيذ — الافتراضي «جارٍ التنفيذ…». */
  pendingText?: string;
  /**
   * اسم وقيمة الزرّ لما يكون زرّ إرسال في نموذج.
   *
   * ⚠️ **اتضافوا عشان نموذج فيه قرارين** (اعتماد/رفض في شاشة
   *    مراجعة صور المدربين). من غيرهم النموذج محتاج حقلًا مخفيًّا
   *    وجافاسكريبت يملاه قبل الإرسال — **وده بيكسر النموذج لو
   *    الجافاسكريبت اتأخّر**، والزرّ بيبعت بلا قرار.
   *
   *    React بيضمّ اسم وقيمة **الزرّ اللي اتضغط** في `FormData`،
   *    فالقرار بيوصل للخادم من غير أي كود.
   */
  name?: string;
  value?: string;
};

export function Button({
  variant = 'primary',
  accentColor = 'brand',
  size = 'md',
  href,
  className = '',
  children,
  disabled,
  pending = false,
  pendingText = 'جارٍ التنفيذ…',
  ...props
}: ButtonProps) {
  const accent: Accent =
    accentColor in ACCENT_ALIAS
      ? ACCENT_ALIAS[accentColor as LegacyAccent]
      : (accentColor as Accent);

  // `min-h-[44px]` = أصغر هدف لمس مقبول على الموبايل، وهي **الموضع
  // الوحيد** في المشروع كله اللي بيضمن ده.
  //
  // ⚠️ جرّبت أكتبها `min-h-[var(--tap-min)]` بالرمز، وبنيت وفحصت الـCSS
  //    المولَّد: **الصنف ده ما اتولّدش خالص**، يعني الزرار كان هيفقد
  //    الـ44px بلا أي تحذير. فبقيت على القيمة الحرفية.
  //    الرمز `--tap-min` معرَّف في `globals.css` وبيتطبّق في المرحلة ٥
  //    على كل الأهداف، وساعتها بيتجرّب في بناء حقيقي قبل ما يتعمّم.
  // ── المرحلة ٤: الحركة ───────────────────────────────────
  //
  // الموقع كان فيه 238 `transition-colors` مقابل **13** بس
  // `transition-transform` — يعني بيغيّر ألوانه ومبيتحركش. وده اللي
  // بيدّي إحساس إنه «ساكن».
  //
  // • الانتقال على خصائص **محددة** مش `transition-all`: `all` بتحرّك
  //   خصائص بتعيد حساب التخطيط وبتتلعثم على الأجهزة الضعيفة
  // • الحركة على `transform` و`box-shadow` بس — الاتنين بيتعملوا على
  //   كارت الشاشة من غير إعادة تخطيط
  // • `motion-safe:` عن قصد: اللي مفعّل «تقليل الحركة» في جهازه
  //   بياخد الألوان من غير أي إزاحة. المشروع كان فيه **صفر**
  //   `motion-safe`/`motion-reduce`
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-control min-h-[44px] ' +
    'transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-ui)] ' +
    'motion-safe:hover:-translate-y-px motion-safe:active:scale-[0.98] hover:shadow-sm';

  const sizeStyles = {
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  // ── المرحلة ١: التباين ──────────────────────────────────
  //
  // النص على الزر الأساسي كان **أبيض**، والنسب المحسوبة على قيم
  // Tailwind 4 الحقيقية (oklch مش hex v3):
  //
  //   أبيض على amber-500    2.15:1  ✗   (المطلوب 4.5:1)
  //   أبيض على emerald-500  2.46:1  ✗
  //   أبيض على rose-500     3.76:1  ✗
  //
  // يعني **كل زر أساسي في الموقع** كان راسبًا في المعيار.
  //
  // الحل اللي اتاخد: الألوان الحيّة تفضل زي ما هي بالظبط، والنص بيبقى
  // داكن (`-ink` = slate-900):
  //
  //   slate-900 على amber-500    8.32:1  ✓
  //   slate-900 على emerald-500  7.24:1  ✓
  //   slate-900 على rose-500     4.75:1  ✓
  //
  // والزر الثانوي كان أسوأ: الحدّ `amber-500` = 2.11:1 (عنصر غير نصي
  // محتاج 3:1)، والنص `amber-600` = 3.14:1. بقوا `-border` (600) و
  // `-strong` (700).
  const colorStyles = {
    primary: {
      brand: 'bg-brand text-brand-ink hover:bg-brand-hover',
      enhaLak: 'bg-enha-lak text-enha-lak-ink hover:bg-enha-lak-hover',
      journey: 'bg-journey text-journey-ink hover:bg-journey-hover',
    },
    // الزر الداكن: نفس الشكل مهما كانت النغمة — ده لون محايد مش نغمة.
    neutral: {
      brand: 'bg-slate-900 text-white hover:bg-slate-800',
      enhaLak: 'bg-slate-900 text-white hover:bg-slate-800',
      journey: 'bg-slate-900 text-white hover:bg-slate-800',
    },
    secondary: {
      brand:
        'bg-transparent border-2 border-brand-border text-brand-strong hover:bg-brand-soft',
      enhaLak:
        'bg-transparent border-2 border-enha-lak-border text-enha-lak-strong hover:bg-enha-lak-soft',
      journey:
        'bg-transparent border-2 border-journey-border text-journey-strong hover:bg-journey-soft',
    },
  } as const;

  const classes =
    `${baseStyles} ${sizeStyles[size]} ${colorStyles[variant][accent]} ${className}` +
    (pending ? ' cursor-wait opacity-80' : '');

  if (href) {
    if (disabled) {
      return (
        <span className={`${classes} opacity-50 cursor-not-allowed`}>
          {children}
        </span>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** مؤشر دوران صغير — SVG جوّه المكوّن، بلا أي مكتبة. */
function Spinner() {
  return (
    <svg
      className="me-2 h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}
