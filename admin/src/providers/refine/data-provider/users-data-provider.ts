import type { BaseRecord, DataProvider, GetListResponse } from "@refinedev/core";
import { getSupabaseClient } from "@/providers/supabase-client";
import { adminDataProvider } from "./supabase-data-provider";
import { userRecordSchema, userRowsSchema, type UserRecord } from "@/features/users/model";
import { buildUserListRequest } from "./users-query";

export const USER_CREATE_COMMAND = "users/create";
export const USER_SUSPENSION_COMMAND = "users/suspension";
export const USER_DELETE_COMMAND = "users/delete";
export const USER_ACTIVITY_COMMAND = "users/activity";
export const ADMIN_ROLES_COMMAND = "users/admin-roles";

export type UserCreateSecret = {
  inviteLink?: string;
  oneTimePassword?: string;
};

const createSecrets = new Map<string, UserCreateSecret>();

/** Consume the invite/password once without putting it into Refine's query cache. */
export function consumeUserCreateSecret(userId: string) {
  const value = createSecrets.get(userId);
  createSecrets.delete(userId);
  return value;
}

async function userRequest<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("اتصال لوحة الإدارة غير مكتمل.");
  const { data, error } = await client.functions.invoke("admin-users", { body });
  if (error) {
    let message = "تعذر إكمال عملية المستخدمين. حاول مرة أخرى.";
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

function readUser(value: unknown): UserRecord {
  return userRecordSchema.parse(value);
}

export const usersDataProvider: DataProvider = {
  ...adminDataProvider,
  getList: async <TData extends BaseRecord>(params: Parameters<DataProvider["getList"]>[0]) => {
    const result = userRowsSchema.parse(
      await userRequest(buildUserListRequest(params)),
    );
    return result as unknown as GetListResponse<TData>;
  },
  getOne: async <TData extends BaseRecord>({ id }: Parameters<DataProvider["getOne"]>[0]) => {
    const result = await userRequest<{ data: unknown }>({
      action: "get",
      id: String(id),
    });
    return { data: readUser(result.data) as unknown as TData };
  },
  create: async <TData extends BaseRecord, TVariables>({ variables }: { variables: TVariables }) => {
    const result = await userRequest<{ data: Record<string, unknown> }>({
      action: "create",
      values: variables,
    });
    const { invite_link, one_time_password, ...record } = result.data;
    const user = readUser(record);
    if (typeof invite_link === "string" || typeof one_time_password === "string") {
      createSecrets.set(user.id, {
        ...(typeof invite_link === "string" ? { inviteLink: invite_link } : {}),
        ...(typeof one_time_password === "string"
          ? { oneTimePassword: one_time_password }
          : {}),
      });
    }
    return { data: user as unknown as TData };
  },
  update: async <TData extends BaseRecord, TVariables>({ id, variables }: { id: string | number; variables: TVariables }) => {
    const result = await userRequest<{ data: unknown }>({
      action: "update",
      id: String(id),
      values: variables,
    });
    return { data: readUser(result.data) as unknown as TData };
  },
  deleteOne: async <TData extends BaseRecord>({ id, variables }: Parameters<DataProvider["deleteOne"]>[0]) => {
    const result = await userRequest<{ data: unknown }>({
      action: "delete",
      ...(variables && typeof variables === "object" ? variables : {}),
      userId: String(id),
    });
    return { data: result.data as TData };
  },
  custom: async <TData extends BaseRecord>({ url, method, payload }: { url: string; method: string; payload?: unknown }) => {
    const command = new Map([
      [USER_SUSPENSION_COMMAND, "suspension"],
      [USER_DELETE_COMMAND, "delete"],
      [USER_ACTIVITY_COMMAND, "activity"],
      [ADMIN_ROLES_COMMAND, "admin_roles"],
    ]).get(url);
    if (!command || (method !== "post" && method !== "get")) {
      throw new Error("إجراء المستخدمين غير مدعوم.");
    }
    const result = await userRequest<{ data: unknown }>({
      ...(payload && typeof payload === "object" ? payload : {}),
      action: command,
    });
    return { data: result.data as TData };
  },
};
