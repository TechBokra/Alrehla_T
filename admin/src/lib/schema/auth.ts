import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email("اكتب بريدًا إلكترونيًا صحيحًا.")
    .toLowerCase(),
  password: z.string().min(1, "اكتب كلمة المرور."),
});

export const googleAuthSettingsSchema = z.object({
  external: z.object({ google: z.boolean() }),
});

export const googleSignInSchema = z.object({
  providerName: z.literal("google"),
});
export type SignInValues = z.output<typeof signInSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type GoogleSignInValues = z.output<typeof googleSignInSchema>;
export type AdminLoginValues = SignInValues | GoogleSignInValues;
export type GoogleAuthSettings = z.output<typeof googleAuthSettingsSchema>;
