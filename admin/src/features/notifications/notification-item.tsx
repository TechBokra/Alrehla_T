import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { notificationTime, type HeaderNotification } from "./queries";

export function NotificationItem({
  notification,
}: {
  notification: HeaderNotification;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 transition-colors",
        notification.is_read
          ? "border-border bg-muted/30"
          : "border-primary/30 bg-primary/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          dir="auto"
          className={cn(
            "min-w-0 break-words font-medium",
            notification.is_read ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {notification.title}
        </p>
        <Badge variant={notification.is_read ? "outline" : "default"}>
          {notification.is_read ? "مقروء" : "غير مقروء"}
        </Badge>
      </div>
      {notification.message && (
        <p
          dir="auto"
          className="whitespace-pre-wrap break-words text-sm text-muted-foreground"
        >
          {notification.message}
        </p>
      )}
      <time
        dateTime={notification.created_at}
        className="text-xs text-muted-foreground"
      >
        <bdi>{notificationTime(notification.created_at)}</bdi>
      </time>
    </li>
  );
}
