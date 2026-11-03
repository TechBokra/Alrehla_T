import { Link } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { settingsItems, type SettingsTab } from "./tabs";

// Adapted from the CLI-installed shadcn sidebar-13 block for an embedded page.
export function SettingsSidebar({ tab }: { tab: SettingsTab }) {
  return (
    <Sidebar
      side="right"
      collapsible="none"
      role="navigation"
      aria-label="أقسام الإعدادات"
      className="h-auto w-full shrink-0 rounded-t-xl border-b md:w-52 md:rounded-s-xl md:rounded-e-none md:border-e md:border-b-0"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="flex-row flex-wrap md:flex-col">
              {settingsItems.map(({ value, label, icon: Icon }) => (
                <SidebarMenuItem key={value} className="min-w-0 grow md:grow-0">
                  <SidebarMenuButton asChild isActive={tab === value}>
                    <Link
                      to="/settings"
                      search={{ tab: value }}
                      aria-current={tab === value ? "page" : undefined}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
