import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { notificationBadge } from "./queries";
import { NotificationItem } from "./notification-item";
import { MarkAllReadButton } from "./mark-all-read-button";
import { useHeaderNotifications } from "./use-header-notifications";

export function NotificationsPopover() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    hasListData,
    isLoading,
    isFetching,
    hasError,
    retry,
  } = useHeaderNotifications();
  const badge = notificationBadge(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount === undefined
              ? "الإشعارات"
              : `الإشعارات، ${new Intl.NumberFormat("ar-EG").format(unreadCount)} غير مقروءة`
          }
        >
          <Bell aria-hidden="true" />
          {badge && (
            <Badge
              className="absolute -top-2 -end-2 min-w-5 px-1"
              aria-hidden="true"
            >
              <bdi dir="ltr">{badge}</bdi>
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        aria-labelledby={titleId}
        className="w-96 max-w-[calc(100vw-1.5rem)]"
      >
        <PopoverHeader>
          <PopoverTitle id={titleId}>الإشعارات</PopoverTitle>
        </PopoverHeader>
        <MarkAllReadButton unreadCount={unreadCount} />

        {hasError && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-destructive">
              تعذّر تحديث الإشعارات أو عدّادها.
              {hasListData && " البيانات المعروضة من آخر تحميل ناجح."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void retry()}
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
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
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </div>
        ) : hasListData && notifications.length === 0 ? (
          <p role="status" className="py-6 text-center text-muted-foreground">
            لا توجد إشعارات
          </p>
        ) : hasListData ? (
          <div
            className="max-h-[min(24rem,60svh)] overflow-y-auto overscroll-contain"
            tabIndex={0}
            role="region"
            aria-label="قائمة الإشعارات"
          >
            <ul className="flex flex-col gap-3">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </ul>
          </div>
        ) : null}
        <Button asChild variant="ghost" className="w-full">
          <Link to="/notifications" onClick={() => setOpen(false)}>
            عرض كل الإشعارات
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
