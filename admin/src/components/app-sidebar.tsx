import { Link, useLocation } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { Images, Blocks, Table2, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";
import { SiteBranding } from "./site-branding";

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  logOut: () => void;
  isLoggingOut: boolean;
};

export function AppSidebar({
  user,
  logOut,
  isLoggingOut,
  ...props
}: AppSidebarProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <Sidebar side="right" collapsible="icon" {...props}>
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="الرئيسية"
              className="justify-center"
            >
              <Link to="/" aria-label="الرئيسية">
                <SiteBranding />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>إدارة الحسابات</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathname.startsWith("/users")}
                  tooltip="المستخدمون"
                >
                  <Link to="/users">
                    <Users />
                    <span>المستخدمون</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>إدارة الكتالوج</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathname.startsWith("/uploads")}
                  tooltip="المرفوعات"
                >
                  <Link to="/uploads">
                    <Images />
                    <span>المرفوعات</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathname.startsWith("/catalog/products")}
                  tooltip="منتجات المنصة"
                >
                  <Link to="/catalog/products">
                    <Table2 />
                    <span>منتجات المنصة</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={pathname.startsWith("/catalog/addons")}
                  tooltip="الإضافات"
                >
                  <Link to="/catalog/addons">
                    <Blocks />
                    <span>الإضافات</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser user={user} isLoggingOut={isLoggingOut} signOut={logOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
