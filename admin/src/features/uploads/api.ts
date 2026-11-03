import { getSupabaseClient } from "@/providers/supabase-client";
import { mediaPageSchema } from "./model";

/** Internal media service used by upload signing and the product image picker. */
export async function requestMediaLibrary<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("اتصال لوحة الإدارة غير مكتمل.");

  const { data, error } = await client.functions.invoke("media-library", {
    body,
  });
  if (error) {
    let message = "تعذر تحميل مكتبة الوسائط. تحقق من الاتصال ثم حاول مرة أخرى.";
    const response = "context" in error ? error.context : null;
    if (response instanceof Response) {
      try {
        const result = await response.json();
        if (typeof result.error === "string") message = result.error;
      } catch {
        // Keep the safe fallback.
      }
    }
    throw new Error(message);
  }

  return data as T;
}

export async function listProductMediaAssets({
  search,
  cursor,
}: {
  search: string;
  cursor: string;
}) {
  const response = await requestMediaLibrary({
    action: "list",
    folder: "alrehla/products",
    search,
    cursor: cursor || undefined,
    sort: "desc",
  });
  return mediaPageSchema.parse(response);
}
