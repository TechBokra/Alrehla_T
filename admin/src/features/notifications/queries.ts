import type { HttpError, UseListProps } from "@refinedev/core";
import type { Database } from "@/types/supabase";

export type HeaderNotification = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "title" | "message" | "is_read" | "created_at"
>;

export const NOTIFICATIONS_PROVIDER = "notifications";
export const NOTIFICATION_POLL_INTERVAL = 10_000;
type NotificationListOptions<T extends { id: string }> = UseListProps<
  T,
  HttpError,
  T
>;

/** Recipient filters are part of Refine's query keys as well as the requests. */
export function headerNotificationQueries(recipientId?: string) {
  const shared = {
    resource: "notifications",
    dataProviderName: NOTIFICATIONS_PROVIDER,
    liveMode: "off",
    errorNotification: false,
    queryOptions: {
      enabled: Boolean(recipientId),
      refetchInterval: NOTIFICATION_POLL_INTERVAL,
      refetchIntervalInBackground: false,
      retry: false,
      // Never carry another recipient's result over when the query key changes.
      placeholderData: undefined,
    },
  } satisfies NotificationListOptions<HeaderNotification>;
  const recipientFilter = {
    field: "recipient_profile_id",
    operator: "eq" as const,
    value: recipientId ?? "",
  };

  return {
    list: {
      ...shared,
      filters: [recipientFilter],
      pagination: { currentPage: 1, pageSize: 20, mode: "server" },
      sorters: [
        { field: "created_at", order: "desc" },
        { field: "id", order: "desc" },
      ],
      meta: { select: "id,title,message,is_read,created_at" },
    } satisfies NotificationListOptions<HeaderNotification>,
    unread: {
      ...shared,
      filters: [
        recipientFilter,
        { field: "is_read", operator: "eq", value: false },
      ],
      pagination: { currentPage: 1, pageSize: 1, mode: "server" },
      meta: { select: "id", count: "exact" },
    } satisfies NotificationListOptions<Pick<HeaderNotification, "id">>,
  };
}

export function notificationBadge(count: number | undefined) {
  if (count === undefined || count <= 0) return undefined;
  return count > 99 ? "99+" : new Intl.NumberFormat("ar-EG").format(count);
}

const cairoTime = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo",
  dateStyle: "medium",
  timeStyle: "short",
});

export function notificationTime(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "وقت غير متاح" : cairoTime.format(date);
}
