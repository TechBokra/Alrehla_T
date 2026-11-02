import { useEffect, useState, type ComponentType } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useResourceAuthorization } from "@/hooks/resources";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavMainItem = {
  title: string;
  resource: string;
  icon: ComponentType<{ className?: string }>;
  items: { title: string; url: string }[];
};

export function NavMain({ items }: { items: NavMainItem[] }) {
  return (
    <SidebarGroup className="hidden py-1 has-data-authorized-sidebar-item:flex">
      <SidebarGroupLabel>الكتالوج</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavMainGroup key={item.resource} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavMainGroup({ item }: { item: NavMainItem }) {
  const access = useResourceAuthorization(item.resource, "list");
  const pathname = useLocation({ select: (location) => location.pathname });
  const { state, isMobile } = useSidebar();
  const active = item.items.some(
    (child) => pathname === child.url || pathname.startsWith(`${child.url}/`),
  );
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active, pathname]);
  if (access.isPending)
    return (
      <SidebarMenuItem data-authorized-sidebar-item>
        <SidebarMenuSkeleton
          showIcon
          role="status"
          aria-label="جارٍ التحقق من صلاحيات إعدادات الكتالوج"
        />
      </SidebarMenuItem>
    );
  if (access.isError)
    return (
      <SidebarMenuItem data-authorized-sidebar-item>
        <SidebarMenuButton
          disabled={access.isFetching}
          onClick={() => void access.refetch()}
        >
          تعذّر التحقق — إعادة المحاولة
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  if (!access.allowed) return null;
  const Icon = item.icon;
  if (state === "collapsed" && !isMobile)
    return (
      <SidebarMenuItem data-authorized-sidebar-item>
        <SidebarMenuButton
          asChild
          size="sm"
          tooltip={item.title}
          isActive={active}
        >
          <Link to={item.items[0].url}>
            <Icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem data-authorized-sidebar-item>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton size="sm" tooltip={item.title} isActive={active}>
            <Icon />
            <span>{item.title}</span>
            <ChevronRightIcon className="ms-auto transition-transform rtl:-scale-x-100 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((child) => (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton asChild isActive={pathname === child.url}>
                  <Link to={child.url}>
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
