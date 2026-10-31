import type { NotificationProvider } from "@refinedev/core";
import { toast } from "sonner";
import { arabicErrorDescription } from "@/lib/notification-messages";
import { UndoableNotification } from "@/components/refine-ui/notification/undoable-notification";

export function useNotificationProvider(): NotificationProvider {
  return {
    open: ({
      key,
      type,
      message,
      description,
      undoableTimeout,
      cancelMutation,
    }) => {
      switch (type) {
        case "success":
          toast.success(message, { id: key, richColors: true });
          return;
        case "error":
          toast.error(
            /[\u0600-\u06ff]/.test(message) ? message : "تعذر إكمال العملية.",
            {
              id: key,
              description: arabicErrorDescription(description),
              richColors: true,
            },
          );
          return;
        case "progress": {
          const toastId = key || Date.now();
          toast(
            () => (
              <UndoableNotification
                message={message}
                description={description}
                undoableTimeout={undoableTimeout}
                cancelMutation={cancelMutation}
                onClose={() => toast.dismiss(toastId)}
              />
            ),
            {
              id: toastId,
              duration: (undoableTimeout || 5) * 1000,
              unstyled: true,
            },
          );
          return;
        }
        default:
          return;
      }
    },
    close: (id) => toast.dismiss(id),
  };
}
