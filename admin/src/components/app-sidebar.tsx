import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { adminNavigationGroups } from "@/providers/refine/resources";
import { AuthorizedSidebarItem } from "./authorized-sidebar-item";
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
        {adminNavigationGroups.map((group) => (
          <SidebarGroup key={group.label} className="hidden py-1 has-[[data-authorized-sidebar-item]]:flex">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => <AuthorizedSidebarItem key={item.resource} item={item} />)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser user={user} isLoggingOut={isLoggingOut} signOut={logOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
