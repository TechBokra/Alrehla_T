import type { BaseRecord, DataProvider } from "@refinedev/core";
import { adminDataProvider } from "./supabase-data-provider";
import { getSupabaseClient } from "@/providers/supabase-client";
import { profileSchema, type ProfileRecord } from "@/features/profile/model";

export function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("اتصال الحساب غير متاح حاليًا.");
  return client;
}

export async function currentUser() {
  const { data, error } = await requireClient().auth.getUser();
  if (error || !data.user) throw new Error("انتهت الجلسة. سجّل الدخول مجددًا.");
  return data.user;
}

export const profileDataProvider: DataProvider = {
  ...adminDataProvider,
  getOne: async <TData extends BaseRecord>({
    id,
  }: Parameters<DataProvider["getOne"]>[0]) => {
    const user = await currentUser();
    if (String(id) !== user.id)
      throw new Error("لا يمكنك عرض ملف حساب آخر هنا.");
    const { data, error } = await requireClient()
      .from("user_profiles")
      .select("id, full_name, avatar_url, role")
      .eq("id", user.id)
      .single();
    if (error) throw new Error("تعذر تحميل الملف الشخصي. حاول مرة أخرى.");
    const google = user.identities?.find(
      (identity) => identity.provider === "google",
    );
    const profile: ProfileRecord = {
      ...data,
      email: user.email ?? "",
      emailConfirmed: Boolean(user.email_confirmed_at),
      googleLinked: Boolean(google),
      googleEmail:
        typeof google?.identity_data?.email === "string"
          ? google.identity_data.email
          : null,
    };
    return { data: profile as unknown as TData };
  },
  update: async <TData extends BaseRecord, TVariables>({
    id,
    variables,
  }: {
    id: string | number;
    variables: TVariables;
  }) => {
    const user = await currentUser();
    if (String(id) !== user.id)
      throw new Error("لا يمكنك تعديل ملف حساب آخر هنا.");
    const values = profileSchema.parse(variables);
    const { data, error } = await requireClient()
      .from("user_profiles")
      .update({
        full_name: values.full_name,
        avatar_url: values.avatar_url || null,
      })
      .eq("id", user.id)
      .select("id, full_name, avatar_url, role")
      .single();
    if (error) throw new Error("تعذر حفظ الملف الشخصي. حاول مرة أخرى.");
    return { data: data as unknown as TData };
  },
};
