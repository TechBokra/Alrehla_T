import type { I18nProvider } from "@refinedev/core";

const messages: Record<string, string> = {
  "buttons.create": "إنشاء",
  "buttons.edit": "تعديل",
  "buttons.show": "عرض",
  "buttons.delete": "حذف",
  "buttons.refresh": "تحديث",
  "buttons.clone": "نسخ",
  "buttons.list": "عرض القائمة",
  "buttons.cancel": "إلغاء",
  "buttons.confirm": "هل أنت متأكد؟",
  "buttons.undo": "تراجع",
  "pages.error.title": "الصفحة غير موجودة",
  "pages.error.description": "الصفحة التي تبحث عنها غير موجودة.",
  "pages.error.backHome": "العودة إلى الرئيسية",
};

export const arabicEgyptI18nProvider: I18nProvider = {
  translate: (key, options, defaultMessage) =>
    messages[key] ??
    defaultMessage ??
    (typeof options === "string" ? options : key),
  changeLocale: () => "ar-EG",
  getLocale: () => "ar-EG",
};
