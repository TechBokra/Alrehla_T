import { z } from "zod";

export const signInSchema = z.object({
    email: z.string().trim().email("اكتب بريدًا إلكترونيًا صحيحًا.").toLowerCase(),
    password: z.string().min(1, "اكتب كلمة المرور."),
});

export const googleAuthSettingsSchema = z.object({
  external: z.object({ google: z.boolean() }),
});
