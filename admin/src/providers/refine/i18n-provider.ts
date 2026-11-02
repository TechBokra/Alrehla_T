import type { I18nProvider } from "@refinedev/core";

const translations: Record<string, string> = {
  "notifications.error": "تعذر إكمال العملية.",
  "notifications.createSuccess": "تمت الإضافة .",
  "notifications.editSuccess": "تم حفظ .",
  "notifications.deleteSuccess": "تم الحذف .",
  "notifications.createError": "تعذرت الإضافة.",
  "notifications.editError": "تعذر حفظ .",
  "notifications.deleteError": "تعذر الحذف.",
  "notifications.importProgress": "جارٍ استيراد البيانات…",
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

function undoMessage(seconds: unknown) {
  const count = Number(seconds);
  if (!Number.isFinite(count) || count < 0)
    return "يمكنك التراجع قبل تنفيذ العملية.";
  const number = new Intl.NumberFormat("ar-EG").format(count);
  const forms = {
    zero: "جارٍ تنفيذ العملية…",
    one: "يمكنك التراجع خلال ثانية واحدة.",
    two: "يمكنك التراجع خلال ثانيتين.",
    few: `يمكنك التراجع خلال ${number} ثوانٍ.`,
    many: `يمكنك التراجع خلال ${number} ثانية.`,
    other: `يمكنك التراجع خلال ${number} ثانية.`,
  };
  return forms[new Intl.PluralRules("ar-EG").select(count)];
}

export const arabicEgyptI18nProvider: I18nProvider = {
  translate: (key, options, defaultMessage) =>
    (key === "notifications.undoable"
      ? undoMessage(typeof options === "object" ? options?.seconds : undefined)
      : translations[key]) ??
    defaultMessage ??
    (typeof options === "string" ? options : key),
  changeLocale: () => "ar-EG",
  getLocale: () => "ar-EG",
};
