import { z } from "zod";

export const profileSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "اكتب الاسم كاملًا.")
      .max(120, "الاسم طويل جدًا."),
    avatar_url: z.union([
      z.literal(""),
      z
        .string()
        .url("رابط الصورة غير صحيح.")
        .startsWith("https://", "استخدم رابط صورة آمنًا."),
    ]),
  })
  .strict();
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "استخدم ١٢ حرفًا على الأقل.")
      .max(128, "استخدم ١٢٨ حرفًا كحد أقصى."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين.",
    path: ["confirmPassword"],
  });
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "اكتب كلمة المرور الحالية."),
    password: z
      .string()
      .min(12, "استخدم ١٢ حرفًا على الأقل.")
      .max(128, "استخدم ١٢٨ حرفًا كحد أقصى."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين.",
    path: ["confirmPassword"],
  });
export const recoverySchema = z.object({
  email: z.string().trim().email("اكتب بريدًا إلكترونيًا صحيحًا."),
});
export type ProfileRecord = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  email: string;
  googleLinked: boolean;
  googleEmail: string | null;
  emailConfirmed: boolean;
};
