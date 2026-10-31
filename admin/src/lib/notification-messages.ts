/** Keep Arabic feature messages; present server errors in the interface language. */
export function arabicErrorDescription(description?: string) {
  if (!description || /[\u0600-\u06ff]/.test(description)) return description;
  if (/failed to fetch|network|timeout|timed out|connection/i.test(description))
    return "تعذر الاتصال بالخدمة. تحقق من اتصالك ثم حاول مجددًا.";
  if (
    /permission denied|not authorized|unauthorized|forbidden|row.level security|jwt|session expired/i.test(
      description,
    )
  )
    return "الجلسة غير صالحة أو لا تملك صلاحية تنفيذ هذا الإجراء.";
  if (/duplicate|already exists|unique constraint/i.test(description))
    return "توجد بيانات مسجلة بالقيمة نفسها. راجع البيانات وحاول مجددًا.";
  if (/foreign key|still referenced/i.test(description))
    return "هذا السجل مرتبط ببيانات أخرى. راجع الارتباطات قبل المتابعة.";
  if (/not found|no rows/i.test(description))
    return "البيانات المطلوبة غير موجودة. حدّث الصفحة وحاول مجددًا.";
  return "حاول مجددًا. إذا استمرت المشكلة، تواصل مع مسؤول النظام.";
}
