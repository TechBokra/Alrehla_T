import {
  ChevronDown,
  FilePenLine,
  Images,
  Package,
  PackagePlus,
  Plus,
  Send,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/components/ui/direction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Presentation only; destinations and action handlers will be connected later.
const headerActions = [
  { id: "new-article", label: "مقال جديد", icon: FilePenLine },
  { id: "new-package", label: "باقة جديدة", icon: PackagePlus },
  { id: "new-product", label: "منتج جديد للمنصة", icon: Package },
  { id: "send-notification", label: "إرسال إشعار", icon: Send },
  { id: "site-settings", label: "الإعدادات وشريط التنبيه", icon: Settings },
  { id: "site-images", label: "صور الموقع", icon: Images },
  { id: "shipping-prices", label: "أسعار الشحن", icon: Truck },
  { id: "users", label: "المستخدمون", icon: Users },
];

export function HeaderActions() {
  const direction = useDirection();

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button type="button">
          إجراءات سريعة
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-1.5rem)]"
        collisionPadding={12}
      >
        <DropdownMenuGroup>
          {headerActions.map(({ id, label, icon: Icon }) => (
            <DropdownMenuItem key={id}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
