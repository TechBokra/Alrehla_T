import { useContext, type ComponentType } from "react";
import { ResourceContext } from "./resource-context";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useDirection } from "@/components/ui/direction";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export interface ResourceRowAction {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: (id: string) => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}
export function createResourceActions({
  onEdit,
  onDelete,
}: {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}): ResourceRowAction[] {
  return [
    { key: "edit", label: "تعديل", icon: Pencil, onSelect: onEdit },
    {
      key: "delete",
      label: "حذف",
      icon: Trash2,
      variant: "destructive",
      onSelect: onDelete,
    },
  ];
}
export function ResourceRowActions({
  id,
  actions,
  disabled,
}: {
  id: string;
  actions?: ResourceRowAction[];
  disabled?: boolean;
}) {
  const direction = useDirection();
  const context = useContext(ResourceContext);
  const resolvedActions =
    actions ??
    context?.rowActions ??
    (context
      ? createResourceActions({
          onEdit: context.openEdit,
          onDelete: context.openDelete,
        })
      : []);
  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled || !resolvedActions.length}
          aria-label="إجراءات السجل"
          onClick={(event) => event.stopPropagation()}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuGroup>
          {resolvedActions.map(
            ({ key, label, icon: Icon, onSelect, ...props }) => (
              <DropdownMenuItem
                key={key}
                {...props}
                onSelect={() => onSelect(id)}
              >
                <Icon />
                {label}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
