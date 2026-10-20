import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import {
  Blocks,
  CalendarDays,
  ClipboardList,
  CircleHelp,
  FileCode2,
  Home,
  Palette,
  Table2,
  TextCursorInput,
} from "lucide-react";
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
import {
  showcaseNavigation,
  type ShowcaseSection,
} from "@/features/component-showcase/sections";
import { NavUser } from "./nav-user";

const sectionIcons = {
  theme: Palette,
  "ui-primitives": Blocks,
  "data-view": Table2,
  fields: TextCursorInput,
  forms: ClipboardList,
  "form-prototype": FileCode2,
  calendar: CalendarDays,
} satisfies Record<ShowcaseSection, typeof Palette>;

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  activeSection: ShowcaseSection;
  user: {
    name: string;
    email: string;
    avatar: string;
  };
};

export function AppSidebar({ activeSection, user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Home"
              className="justify-center"
            >
              <Link to="/" aria-label="Home">
                <Home aria-hidden="true" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Preview sections</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {showcaseNavigation.map((item) => {
                const Icon = sectionIcons[item.id];

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={activeSection === item.id}
                      tooltip={item.label}
                    >
                      <Link
                        to={item.to}
                        aria-label={`${item.label}: ${item.description}`}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Theme tokens">
                  <Link to="/theme">
                    <Palette />
                    <span>Theme tokens</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Component notes">
                  <Link to="/ui-primitives">
                    <CircleHelp />
                    <span>Component notes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
