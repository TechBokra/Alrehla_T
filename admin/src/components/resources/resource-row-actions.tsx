import { useContext, useRef, useState, type ComponentType } from "react";
import type { BaseRecord } from "@refinedev/core";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import { useResourceAuthorization } from "@/hooks/resources/use-resource-authorization";
import { useDirection } from "@/components/ui/direction";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ResourceContext } from "./resource-context";

export interface ResourceRowAction {
  key: string;
  authorizationAction: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: (id: string) => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}
export function createResourceActions({ onEdit, onDelete }: {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}): ResourceRowAction[] {
  return [
    { key: "edit", authorizationAction: "edit", label: "تعديل", icon: Pencil, onSelect: onEdit },
    { key: "delete", authorizationAction: "delete", label: "حذف", icon: Trash2, variant: "destructive", onSelect: onDelete },
  ];
}

export function ResourceRowActions({ id, actions, disabled }: {
  id: string;
  actions?: ResourceRowAction[];
  disabled?: boolean;
}) {
  const context = useContext(ResourceContext);
  if (!context) return null;
  const candidates = (actions ?? context.rowActions ?? createResourceActions({
    onEdit: context.openEdit, onDelete: context.openDelete,
  })).filter((action) => {
    if (action.authorizationAction === "edit") return context.canEditRow(id);
    if (action.authorizationAction === "delete") return context.canDeleteRow(id);
    return Boolean(action.authorizationAction);
  });
  if (!candidates.length) return null;
  return <AuthorizeActions resource={context.resource} id={id} record={context.getRecord(id)}
    remaining={candidates} allowed={[]} disabled={disabled} />;
}

type ActionAuthorizationProps = {
  resource: string;
  id: string;
  record?: BaseRecord;
  remaining: ResourceRowAction[];
  allowed: ResourceRowAction[];
  disabled?: boolean;
};

/** One hook per component keeps arbitrary custom-action lists hook-safe. */
function AuthorizeActions({ remaining, allowed, ...props }: ActionAuthorizationProps) {
  const [action, ...rest] = remaining;
  const access = useResourceAuthorization(props.resource, action.authorizationAction, {
    id: props.id, record: props.record,
  });
  const authorized = access.allowed ? [...allowed, action] : allowed;
  if (rest.length) return <AuthorizeActions key={rest[0].key} {...props} remaining={rest} allowed={authorized} />;
  return <AuthorizedActionMenu {...props} actions={authorized} />;
}

function AuthorizedActionMenu({ actions, resource, id, record, disabled }: {
  actions: ResourceRowAction[];
  resource: string;
  id: string;
  record?: BaseRecord;
  disabled?: boolean;
}) {
  const direction = useDirection();
  const inFlight = useRef(false);
  const [checking, setChecking] = useState(false);
  if (!actions.length) return null;
  async function select(action: ResourceRowAction) {
    if (inFlight.current || disabled || action.disabled) return;
    inFlight.current = true;
    setChecking(true);
    try {
      await assertResourceAccess(resource, action.authorizationAction, { id, record });
      action.onSelect(id);
    } catch (error) {
      toast.error("تعذّر تنفيذ الإجراء", {
        description: error instanceof Error ? error.message : "تعذّر التحقق من الصلاحيات.",
      });
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }
  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled || checking}
          aria-label="إجراءات السجل" onClick={(event) => event.stopPropagation()}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuGroup>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem key={action.key} variant={action.variant} disabled={action.disabled || checking}
                onSelect={() => void select(action)}>
                <Icon />{action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
