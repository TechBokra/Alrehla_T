import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export interface FormFieldHelpProps {
  description?: ReactNode;
  label?: ReactNode;
}

export function FormFieldHelp({ description, label }: FormFieldHelpProps) {
  if (description == null || description === "" || description === false)
    return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <CircleHelp aria-hidden="true" className="size-4" />
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-sm text-start text-sm">
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { FormFieldHelp as FieldHelp };

export { FormFieldHelp as DescriptionBadge };
