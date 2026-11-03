import { Languages, SlidersHorizontal, Target } from "lucide-react";

export const settingsItems = [
  {
    value: "customization-fields",
    label: "خانات التخصيص",
    icon: SlidersHorizontal,
  },
  { value: "story-goals", label: "أهداف التخصيص", icon: Target },
  { value: "writing-dialects", label: "لهجات الكتابة", icon: Languages },
] as const;

export type SettingsTab = (typeof settingsItems)[number]["value"];
