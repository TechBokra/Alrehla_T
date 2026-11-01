import type { BaseRecord } from "@refinedev/core";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import {
  useResourceAuthorization,
  useResourceContext,
  useResourceRowActions,
} from "@/hooks/resources";
import { useDirection } from "@/components/ui/direction";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { ResourceRowAction } from "../types";

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
  const context = useResourceContext();
  const candidates = (actions ?? context.rowActions ?? createResourceActions({
    onEdit: context.openEdit,
    onDelete: context.openDelete,
  })).filter((action) => {
    if (action.authorizationAction === "edit") return context.canEditRow(id);
    if (action.authorizationAction === "delete") return context.canDeleteRow(id);
    return Boolean(action.authorizationAction);
  });

  if (!candidates.length) return null;
  return (
    <AuthorizeActions
      resource={context.resource}
      id={id}
      record={context.getRecord(id)}
      remaining={candidates}
      allowed={[]}
      disabled={disabled}
    />
  );
}

type ActionAuthorizationProps = {
  resource: string;
  id: string;
  record?: BaseRecord;
  remaining: ResourceRowAction[];
  allowed: ResourceRowAction[];
  disabled?: boolean;
};

/** Keep one access hook per action in a stable, keyed component boundary. */
function AuthorizeActions({ remaining, allowed, ...props }: ActionAuthorizationProps) {
  const [action, ...rest] = remaining;
  const access = useResourceAuthorization(props.resource, action.authorizationAction, {
    id: props.id,
    record: props.record,
  });
  const authorized = access.allowed ? [...allowed, action] : allowed;
  if (rest.length) {
    return <AuthorizeActions key={rest[0].key} {...props} remaining={rest} allowed={authorized} />;
  }
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
  const { checking, execute } = useResourceRowActions({ resource, id, record });
  if (!actions.length) return null;
  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled || checking}
          aria-label="إجراءات السجل"
          onClick={(event) => event.stopPropagation()}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuGroup>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.key}
                variant={action.variant}
                disabled={action.disabled || checking}
                onSelect={() => void execute(action)}
              >
                <Icon />{action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
