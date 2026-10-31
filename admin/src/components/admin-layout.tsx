import { useAdminIdentity } from "@/features/auth/identity-provider";
import type { CSSProperties, ReactNode } from "react";
import { useLogout } from "@refinedev/core";
import { Link, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { NotificationsPopover } from "@/features/notifications/notifications-popover";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

export function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/+$/, "") || "/",
  });
  const pageLabel = getPageLabel(pathname);
  const { data: identity } = useAdminIdentity();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const user = {
    name: identity?.name ?? "حساب الإدارة",
    email: identity?.email ?? "",
    avatar: identity?.avatar ?? "",
  };

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--sidebar-width": "14rem" } as CSSProperties}
    >
      <AppSidebar user={user} logOut={logout} isLoggingOut={isLoggingOut} />
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
                    {pageLabel}
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

        <main className="mx-auto flex w-full max-w-375 flex-col gap-12 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function getPageLabel(pathname: string) {
  if (pathname.startsWith("/catalog/addons")) return "الإضافات";
  if (pathname.startsWith("/catalog/products")) return "منتجات المنصة";
  if (pathname.startsWith("/notifications")) return "الإشعارات";
  if (pathname.startsWith("/users")) return "المستخدمون";
  if (pathname.startsWith("/uploads")) return "المرفوعات";
  if (pathname.startsWith("/profile")) return "الملف الشخصي";
  return "لوحة الإدارة";
}
