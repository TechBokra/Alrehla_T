import { useRef, useState } from "react";
import { toast } from "sonner";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import type { ResourceRowAction } from "@/components/resources/types";
import type { BaseRecord } from "@refinedev/core";

/** Runs an authorized row command once and owns its preflight/error feedback. */
export function useResourceRowActions({
  resource,
  id,
  record,
}: {
  resource: string;
  id: string;
  record?: BaseRecord;
}) {
  const inFlight = useRef(false);
  const [checking, setChecking] = useState(false);

  async function execute(action: ResourceRowAction) {
    if (inFlight.current || action.disabled) return false;
    inFlight.current = true;
    setChecking(true);
    try {
      await assertResourceAccess(resource, action.authorizationAction, { id, record });
      action.onSelect(id);
      return true;
    } catch (error) {
      toast.error("تعذّر تنفيذ الإجراء", {
        description: error instanceof Error ? error.message : "تعذّر التحقق من الصلاحيات.",
      });
      return false;
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }
  return { checking, execute };
}
