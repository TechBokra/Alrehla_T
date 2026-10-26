import type { CSSProperties, ReactNode } from "react";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Link } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { NotificationsPopover } from "@/features/notifications/notifications-popover";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ShowcaseSection } from "@/features/component-showcase/sections";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
type ShowcaseIdentity = {
  name?: string;
  email?: string;
  avatar?: string;
  image?: string;
};

export function AdminLayout({
  activeSection,
  pageLabel,
  children,
}: {
  activeSection?: ShowcaseSection;
  pageLabel?: string;
  children: ReactNode;
}) {
  const { data: identity } = useGetIdentity<ShowcaseIdentity>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const user = {
    name: identity?.name ?? "حساب الإدارة",
    email: identity?.email ?? "",
    avatar: identity?.avatar ?? identity?.image ?? "",
  };

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--sidebar-width": "14rem" } as CSSProperties}
    >
      <AppSidebar
        activeSection={activeSection}
        user={user}
        logOut={logout}
        isLoggingOut={isLoggingOut}
      />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-sidebar-border bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="h-5" />
            <Breadcrumb aria-label="مسار التنقل">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      to="/"
                      aria-label="الرئيسية"
                      className="inline-flex items-center gap-1.5"
                    >
                      <Home className="size-4" aria-hidden="true" />
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block">
                  /
                </BreadcrumbSeparator>
                <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
                  <BreadcrumbPage className="max-w-48 truncate">
                    {pageLabel ?? "معرض المكوّنات"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <HeaderActions />
            <NotificationsPopover />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-12 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
