import { Link, useLocation } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import {
  Blocks,
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
} satisfies Record<ShowcaseSection, typeof Palette>;

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  activeSection?: ShowcaseSection;
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  logOut: () => void;
  isLoggingOut: boolean;
};

export function AppSidebar({
  activeSection,
  user,
  logOut,
  isLoggingOut,
  ...props
}: AppSidebarProps) {
  const pathname = useLocation({ select: location => location.pathname });
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
                <Home aria-hidden="true" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>إدارة الكتالوج</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={pathname.startsWith("/catalog/products")} tooltip="منتجات المنصة"><Link to="/catalog/products"><Table2 /><span>منتجات المنصة</span></Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={pathname.startsWith("/catalog/addons")} tooltip="الإضافات"><Link to="/catalog/addons"><Blocks /><span>الإضافات</span></Link></SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>أقسام لوحة التحكم</SidebarGroupLabel>
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
          <SidebarGroupLabel>روابط سريعة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="ألوان وخطوط التصميم">
                  <Link to="/theme">
                    <Palette />
                    <span>ألوان وخطوط التصميم</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="مكوّنات الواجهة">
                  <Link to="/ui-primitives">
                    <CircleHelp />
                    <span>مكوّنات الواجهة</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <NavUser user={user} isLoggingOut={isLoggingOut} signOut={logOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
