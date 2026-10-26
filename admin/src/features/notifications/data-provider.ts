import type { BaseRecord, DataProvider } from "@refinedev/core";
import {
  adminDataProvider,
  DataConfigurationError,
} from "@/providers/data-provider";
import { getSupabaseClient } from "@/providers/supabase-client";

export const MARK_ALL_READ = "notifications/mark-all-read";

/** Refine command identifier, not a public API URL. Uses the shared authenticated client. */
export const notificationsDataProvider: Required<DataProvider> = {
  ...adminDataProvider,
  custom: async <TData extends BaseRecord>({
    url,
    method,
    payload,
  }: {
    url: string;
    method: string;
    payload?: unknown;
  }) => {
    if (url !== MARK_ALL_READ || method !== "post") {
      throw new Error("إجراء الإشعارات غير مدعوم");
    }
    const expectedRecipientId =
      payload && typeof payload === "object" && "expectedRecipientId" in payload
        ? payload.expectedRecipientId
        : undefined;
    const client = getSupabaseClient();
    if (!client) throw new DataConfigurationError();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user || user.id !== expectedRecipientId) {
      throw new Error("تغيّرت جلسة الحساب. أعد تحميل الصفحة ثم حاول مرة أخرى.");
    }
    // One statement covers every unread row, including records beyond pagination.
    // Never accept the recipient to update from the form; derive it from verified auth.
    const { error, count } = await client
      .from("notifications")
      .update({ is_read: true }, { count: "exact" })
      .eq("recipient_profile_id", user.id)
      .eq("is_read", false);
    if (error) throw new Error("تعذّر تحديد الإشعارات كمقروءة. حاول مرة أخرى.");
    return { data: { id: user.id, updated: count ?? 0 } as unknown as TData };
  },
};
