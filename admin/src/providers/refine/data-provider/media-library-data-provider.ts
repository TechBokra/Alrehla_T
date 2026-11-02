import type {
  BaseRecord,
  DataProvider,
  GetListResponse,
} from "@refinedev/core";
import { getSupabaseClient } from "@/providers/supabase-client";
import { adminDataProvider } from "./supabase-data-provider";
import {
  assetSchema,
  mediaPageSchema,
  type MediaAsset,
} from "@/features/uploads/model";

export async function mediaRequest<T>(
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

export const mediaDataProvider: DataProvider = {
  ...adminDataProvider,
  getList: async <TData extends BaseRecord>({
    meta,
    sorters,
  }: Parameters<DataProvider["getList"]>[0]) => {
    const result = mediaPageSchema.parse(
      await mediaRequest({
        action: "list",
        folder: meta?.folder || undefined,
        search: meta?.search || "",
        cursor: meta?.cursor || undefined,
        sort: sorters?.[0]?.order || "desc",
      }),
    );
    return result as unknown as GetListResponse<TData>;
  },
  getOne: async <TData extends BaseRecord>({
    meta,
  }: Parameters<DataProvider["getOne"]>[0]) => {
    const result = await mediaRequest<{ data: unknown }>({
      action: "get",
      publicId: meta?.publicId,
    });
    return { data: assetSchema.parse(result.data) as unknown as TData };
  },
  update: async <TData extends BaseRecord, TVariables>({
    variables,
    meta,
  }: {
    variables: TVariables;
    meta?: Record<string, unknown>;
  }) => {
    const values = variables as { caption: string; alt: string; tags: string[] };
    const result = await mediaRequest<{ data: unknown }>({
      action: "update",
      publicId: meta?.publicId,
      ...values,
    });
    return { data: assetSchema.parse(result.data) as unknown as TData };
  },
  deleteOne: async <TData extends BaseRecord>({
    meta,
  }: Parameters<DataProvider["deleteOne"]>[0]) => {
    const result = await mediaRequest<{ data: MediaAsset }>({
      action: "delete",
      publicId: meta?.publicId,
      confirmPublicId: meta?.publicId,
    });
    return { data: assetSchema.parse(result.data) as unknown as TData };
  },
  create: async () => {
    throw new Error("استخدم زر رفع الصور لإضافة ملف جديد.");
  },
};
