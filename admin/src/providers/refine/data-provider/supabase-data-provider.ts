import type { DataProvider } from "@refinedev/core";
import { dataProvider } from "@refinedev/supabase";
import {
  supabaseConnection,
  type createSupabaseConnection,
} from "@/providers/supabase-client";

export class DataConfigurationError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("اتصال البيانات غير مُعدّ. اضبط VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY ثم أعد تشغيل التطبيق.");
    this.name = "DataConfigurationError";
  }
}

export function createAdminDataProvider(
  connection: ReturnType<typeof createSupabaseConnection>,
): Required<DataProvider> {
  // Resolve lazily: rendering sign-in never requires data configuration.
  let provider: Required<DataProvider> | undefined;
  function getProvider() {
    const client = connection.getClient();
    if (!client) throw new DataConfigurationError();
    provider ??= dataProvider(client);
    return provider;
  }

  return {
    getList: async (params) => getProvider().getList(params),
    getOne: async (params) => getProvider().getOne(params),
    getMany: async (params) => getProvider().getMany(params),
    create: async (params) => getProvider().create(params),
    createMany: async (params) => getProvider().createMany(params),
    update: async (params) => getProvider().update(params),
    updateMany: async (params) => getProvider().updateMany(params),
    deleteOne: async (params) => getProvider().deleteOne(params),
    deleteMany: async (params) => getProvider().deleteMany(params),
    custom: async (params) => getProvider().custom(params),
    getApiUrl: () => {
      if (!connection.apiUrl) throw new DataConfigurationError();
      return connection.apiUrl;
    },
  };
}

export const adminDataProvider = createAdminDataProvider(supabaseConnection);
