import { useAdminIdentity } from "@/features/auth/identity-provider";
import { useRef, useState } from "react";
import { useCustomMutation, useInvalidate } from "@refinedev/core";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARK_ALL_READ } from "./data-provider";
import { NOTIFICATIONS_PROVIDER } from "./queries";

export function MarkAllReadButton({ unreadCount }: { unreadCount?: number }) {
  const { data: identity } = useAdminIdentity();
  const command = useCustomMutation({ mutationOptions: { retry: false } });
  const invalidate = useInvalidate();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function markAllRead() {
    if (inFlight.current || !identity?.id || !unreadCount) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    try {
      await command.mutateAsync({
        url: MARK_ALL_READ,
        method: "post",
        values: { expectedRecipientId: identity.id },
        dataProviderName: NOTIFICATIONS_PROVIDER,
        successNotification: false,
        errorNotification: false,
      });
      try {
        await invalidate({
          resource: "notifications",
          dataProviderName: NOTIFICATIONS_PROVIDER,
          invalidates: ["list"],
        });
      } catch {
        setError(
          "تم تحديد الإشعارات كمقروءة، لكن تعذّر تحديث العرض. أعد تحميله.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "تعذّر تحديد الإشعارات كمقروءة. حاول مرة أخرى.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || !identity?.id || !unreadCount}
        onClick={() => void markAllRead()}
      >
        <CheckCheck data-icon="inline-start" aria-hidden="true" />
        {pending ? "جارٍ التحديد…" : "تحديد الكل كمقروء"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
