export const showcaseSections = [
  "theme",
  "ui-primitives",
  "data-view",
  "fields",
  "forms",
  "form-prototype",
] as const;

export type ShowcaseSection = (typeof showcaseSections)[number];

export const showcaseNavigation: ReadonlyArray<{
  id: ShowcaseSection;
  label: string;
  description: string;
  to:
    | "/theme"
    | "/ui-primitives"
    | "/data-view"
    | "/fields"
    | "/forms"
    | "/form-prototype";
}> = [
  {
    id: "theme",
    label: "التصميم والألوان",
    description: "ألوان الواجهة والخطوط وعناصر التصميم",
    to: "/theme",
  },
  {
    id: "ui-primitives",
    label: "عناصر الواجهة",
    description: "الأزرار والقوائم والنوافذ والتنبيهات",
    to: "/ui-primitives",
  },
  {
    id: "data-view",
    label: "عرض البيانات",
    description: "الجداول والفرز والتصفية والتنقل بين الصفحات",
    to: "/data-view",
  },
  {
    id: "fields",
    label: "الحقول",
    description: "إدخال البيانات والتحقق منها وعرض النتائج",
    to: "/fields",
  },
  {
    id: "forms",
    label: "النماذج",
    description: "نماذج داخل النوافذ والألواح وحالات الحفظ",
    to: "/forms",
  },
  {
    id: "form-prototype",
    label: "تجربة النماذج",
    description: "حقول مترابطة مع عمليات الإنشاء والتعديل",
    to: "/form-prototype",
  },
];
