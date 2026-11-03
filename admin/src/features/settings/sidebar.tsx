import { Link } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { settingsGroups, type ActiveSettingsTab } from "./tabs";

// Adapted from the CLI-installed shadcn sidebar-13 block for an embedded page.
export function SettingsSidebar({
  tab,
  canManageCatalog,
  canManagePlatform,
}: {
  tab: ActiveSettingsTab;
  canManageCatalog: boolean;
  canManagePlatform: boolean;
}) {
  return (
    <Sidebar
      side="right"
      collapsible="none"
      role="navigation"
      aria-label="أقسام الإعدادات"
      className="h-auto w-full shrink-0 rounded-t-xl border-b md:w-52 md:rounded-s-xl md:rounded-e-none md:border-e md:border-b-0"
    >
      <SidebarContent>
        {settingsGroups.map((group) => {
          const allowed =
            group.id === "catalog" ? canManageCatalog : canManagePlatform;
          if (!allowed) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="flex-row flex-wrap md:flex-col">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem
                        key={item.value}
                        className="min-w-0 grow md:grow-0"
                      >
                        {"disabled" in item && item.disabled ? (
                          <SidebarMenuButton
                            disabled
                            aria-disabled="true"
                            title="سيُتاح هذا القسم لاحقًا"
                            tooltip="قريبًا"
                            className="cursor-not-allowed opacity-55"
                          >
                            <Icon aria-hidden="true" />
                            <span>{item.label}</span>
                            <span className="ms-auto text-xs text-muted-foreground">
                              قريبًا
                            </span>
                          </SidebarMenuButton>
                        ) : (
                          <SidebarMenuButton
                            asChild
                            isActive={tab === item.value}
                          >
                            <Link
                              to="/settings"
                              search={{ tab: item.value }}
                              aria-current={
                                tab === item.value ? "page" : undefined
                              }
                            >
                              <Icon aria-hidden="true" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
