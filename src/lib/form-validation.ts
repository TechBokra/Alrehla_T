/**
 * تنبيهات الخانات الناقصة — بالعربي، وباسم الخانة.
 *
 * ── العطل اللي بيقفله ───────────────────────────────────────
 *
 * ملاحظة تامر (١٨ أكتوبر): «التنبيه على الخانة المطلوبة والناقصة
 * يكون واضح وبالعربي».
 *
 * ⚠️ **`required` لوحدها بتدّي رسالة المتصفح، مش رسالتنا.** والرسالة
 *    دي بلغة **المتصفح** مش لغة الموقع: المستخدم اللي كروم عنده
 *    بالإنجليزي بيشوف «Please fill out this field» في وسط صفحة
 *    عربية بالكامل. ومابتقولش **أنهي** خانة لما يكون فيه ١٢ خانة.
 *
 * ⚠️ **وأسوأ من رسالة المتصفح: الزرار المقفول.** في أكتر من شاشة
 *    كان الزر `disabled` لحد ما الخانة تتملا — فالعميل بيدوس ومافيش
 *    حاجة بتحصل، ومافيش سطر بيقول له ليه. الزر بقى شغّال، والضغطة
 *    بتقول السبب.
 *
 * `setCustomValidity` بيستبدل نص المتصفح برسالتنا. ولازم يتصفّى
 * (`''`) أول ما المستخدم يكتب، وإلا الخانة تفضل «غير صالحة» للأبد
 * ولو صحّحها.
 */

export type ValidatableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** «اكتب» للخانة النصية و«اختار» للقايمة — الفعل الغلط بيلغبط. */
function missingVerb(el: ValidatableElement): string {
  if (el.tagName === 'SELECT') return 'اختار';
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
    return 'اختار';
  }
  if (el instanceof HTMLInputElement && el.type === 'file') return 'ارفع';
  return 'اكتب';
}

/** الرسالة المناسبة لسبب الرفض الحقيقي، باسم الخانة. */
export function arabicValidationMessage(el: ValidatableElement, label: string): string {
  const v = el.validity;
  if (v.valueMissing) return `${missingVerb(el)} «${label}» — الخانة دي مطلوبة.`;
  if (v.typeMismatch) {
    if (el instanceof HTMLInputElement && el.type === 'email') {
      return `«${label}» لازم تكون إيميل صح — زي name@example.com`;
    }
    return `«${label}» شكلها مش مظبوط — راجعها.`;
  }
  if (v.patternMismatch) return `«${label}» شكلها مش مظبوط — راجعها.`;
  // `minLength`/`maxLength` موجودة على الخانة والنص الطويل، مش على القايمة.
  if (v.tooShort && 'minLength' in el) {
    return `«${label}» قصيرة — الحد الأدنى ${el.minLength.toLocaleString('ar-EG')} حرف.`;
  }
  if (v.tooLong && 'maxLength' in el) {
    return `«${label}» طويلة — الحد الأقصى ${el.maxLength.toLocaleString('ar-EG')} حرف.`;
  }
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch) {
    return `«${label}» رقم مش مقبول — راجعه.`;
  }
  // ⚠️ `customError` معناها إن حد تاني حط رسالة بإيده — مانمسحهاش.
  if (v.customError) return el.validationMessage;
  return `راجع «${label}».`;
}

/**
 * خصائص الخانة المطلوبة: رسالة عربية باسمها بدل رسالة المتصفح.
 *
 * ```tsx
 * <input {...requiredFieldProps('الاسم بالكامل')} value={…} onChange={…} />
 * ```
 *
 * ⚠️ لازم تتحط **قبل** أي `onInput` بتاعك، وإلا بتتشال. ولو محتاج
 *    الاتنين، نادي `clearCustomValidity(e)` جوّه `onInput` بتاعك.
 */
export function requiredFieldProps(label: string) {
  return {
    required: true,
    onInvalid: (e: React.FormEvent<ValidatableElement>) => {
      const el = e.currentTarget;
      el.setCustomValidity('');
      el.setCustomValidity(arabicValidationMessage(el, label));
    },
    onInput: (e: React.FormEvent<ValidatableElement>) => {
      e.currentTarget.setCustomValidity('');
    },
  };
}

/** للخانات اللي ليها `onInput` خاص بيها. */
export function clearCustomValidity(e: React.FormEvent<ValidatableElement>) {
  e.currentTarget.setCustomValidity('');
}

/**
 * يوصل العميل للخانة الغلط: يحرّكه لمكانها ويحطّ المؤشّر فيها.
 *
 * ⚠️ `focus()` لوحدها مش كفاية على الموبايل: الخانة ممكن تبقى فوق
 *    شاشتين، والعميل يشوف رسالة ومايشوفش هي فين. والتمرير لازم يبقى
 *    `block: 'center'` مش `start` عشان لوحة المفاتيح ماتغطّيهاش.
 */
export function focusField(id: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // التمرير لسه ماشي، والـfocus وهو ماشي بيقطعه في بعض المتصفحات.
  window.setTimeout(() => (el as HTMLElement).focus({ preventScroll: true }), 120);
}
