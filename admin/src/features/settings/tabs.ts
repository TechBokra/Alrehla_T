import {
  Building2,
  CreditCard,
  Languages,
  Megaphone,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Target,
} from "lucide-react";

export const settingsGroups = [
  {
    id: "platform",
    label: "المنصة",
    items: [
      {
        value: "identity-contact",
        label: "الهوية والتواصل",
        icon: Building2,
      },
      {
        value: "appearance-announcements",
        label: "المظهر والإعلانات",
        icon: Megaphone,
        disabled: true,
      },
      {
        value: "privacy-retention",
        label: "الخصوصية والاحتفاظ",
        icon: ShieldCheck,
        disabled: true,
      },
      {
        value: "orders-trainers",
        label: "الطلبات والمدربين",
        icon: ShoppingCart,
        disabled: true,
      },
      {
        value: "payments",
        label: "المدفوعات",
        icon: CreditCard,
        disabled: true,
      },
    ],
  },
  {
    id: "catalog",
    label: "إعدادات المنتجات",
    items: [
      {
        value: "customization-fields",
        label: "خانات التخصيص",
        icon: SlidersHorizontal,
      },
      { value: "story-goals", label: "أهداف التخصيص", icon: Target },
      { value: "writing-dialects", label: "لهجات الكتابة", icon: Languages },
    ],
  },
] as const;

export const activeSettingsTabValues = [
  "identity-contact",
  "customization-fields",
  "story-goals",
  "writing-dialects",
] as const;

export type ActiveSettingsTab = (typeof activeSettingsTabValues)[number];
