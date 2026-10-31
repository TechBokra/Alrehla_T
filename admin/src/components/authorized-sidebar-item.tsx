import { Link, useLocation } from "@tanstack/react-router";
import type { AdminNavigationItem } from "@/providers/refine/resources";
import { useResourceAuthorization } from "@/hooks/resources/use-resource-authorization";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui/sidebar";

export function AuthorizedSidebarItem({ item }: { item: AdminNavigationItem }) {
  const access = useResourceAuthorization(item.resource, "list");
  const pathname = useLocation({ select: (location) => location.pathname });
  if (access.isPending) return (
    <SidebarMenuItem data-authorized-sidebar-item>
      <SidebarMenuSkeleton showIcon role="status" aria-label="جارٍ التحقق من صلاحيات القائمة" />
    </SidebarMenuItem>
  );
  if (access.isError) return (
    <SidebarMenuItem data-authorized-sidebar-item>
      <SidebarMenuButton disabled={access.isFetching} onClick={() => void access.refetch()} tooltip="إعادة التحقق من الصلاحيات">
        تعذّر التحقق — إعادة المحاولة
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
  if (!access.allowed) return null;
  const Icon = item.icon;
  return (
    <SidebarMenuItem data-authorized-sidebar-item>
      <SidebarMenuButton asChild size="sm" tooltip={item.label}
        isActive={pathname === item.to || pathname.startsWith(`${item.to}/`)}>
        <Link to={item.to}><Icon /><span>{item.label}</span></Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
