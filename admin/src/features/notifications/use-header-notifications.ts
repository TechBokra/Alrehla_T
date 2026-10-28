import { useAdminIdentity } from "@/features/auth/identity-provider";
import { useList } from "@refinedev/core";
import { headerNotificationQueries, type HeaderNotification } from "./queries";

export function useHeaderNotifications(page = 1) {
  const identity = useAdminIdentity();
  const recipientId = identity.data?.id;
  const options = headerNotificationQueries(recipientId);
  options.list.pagination.currentPage = page;
  const { query: list } = useList<HeaderNotification>(options.list);
  const { query: unread } = useList<Pick<HeaderNotification, "id">>(
    options.unread,
  );
  const hasIdentity = Boolean(recipientId);

  return {
    notifications: hasIdentity ? (list.data?.data ?? []) : [],
    unreadCount: hasIdentity ? unread.data?.total : undefined,
    total: hasIdentity ? list.data?.total : undefined,
    hasListData: hasIdentity && list.data !== undefined,
    isLoading: identity.isLoading || (hasIdentity && list.isLoading),
    isFetching: hasIdentity && (list.isFetching || unread.isFetching),
    hasError: Boolean(
      identity.isError ||
      (!identity.isLoading && !hasIdentity) ||
      (hasIdentity && (list.isError || unread.isError)),
    ),
    retry: async () => {
      if (!hasIdentity || identity.isError) {
        await identity.refetch();
        return;
      }
      await Promise.all([list.refetch(), unread.refetch()]);
    },
  };
}
