import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationItem } from "./notification-item";
import { useHeaderNotifications } from "./use-header-notifications";

const number = new Intl.NumberFormat("ar-EG");

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const {
    notifications,
    unreadCount,
    total,
    hasListData,
    isLoading,
    isFetching,
    hasError,
    retry,
  } = useHeaderNotifications(page);
  const pages =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / 20));

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="notifications-page-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 id="notifications-page-title" className="text-2xl font-semibold">
            الإشعارات
          </h1>
          <p className="text-sm text-muted-foreground">
            كل إشعارات حسابك، مرتبة من الأحدث إلى الأقدم.
          </p>
        </div>
        <MarkAllReadButton unreadCount={unreadCount} />
      </div>
      {hasError && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">
            تعذّر تحديث الإشعارات أو عدّادها.
            {hasListData && " نعرض آخر بيانات تم تحميلها."}
          </p>
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => void retry()}
          >
            <RefreshCw data-icon="inline-start" />
            إعادة المحاولة
          </Button>
        </div>
      )}
      {isLoading && !hasListData ? (
        <div
          role="status"
          aria-label="جارٍ تحميل الإشعارات"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((id) => (
            <Skeleton key={id} className="h-24 w-full" />
          ))}
        </div>
      ) : hasListData && notifications.length === 0 ? (
        <p role="status" className="py-10 text-center text-muted-foreground">
          لا توجد إشعارات في هذه الصفحة
        </p>
      ) : hasListData ? (
        <ul className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))}
        </ul>
      ) : null}
      {hasListData && (
        <nav
          aria-label="صفحات الإشعارات"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            الصفحة {number.format(page)}
            {pages !== undefined && ` من ${number.format(pages)}`}
            {total !== undefined && ` · ${number.format(total)} إشعارًا`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              disabled={pages === undefined || page >= pages || isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              التالي
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}
