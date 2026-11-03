import { useAdminIdentity } from "@/hooks/auth/use-admin-access";
import type { CSSProperties, ReactNode } from "react";
import { useLogout } from "@refinedev/core";
import { Link, useRouterState } from "@tanstack/react-router";
import { resources } from "@/providers/refine/resources";
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

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/+$/, "") || "/",
  });
  const resourceAction = getResourceAction(pathname);
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
                {resourceAction ? (
                  <>
                    <BreadcrumbItem className="inline-flex min-w-0">
                      {resourceAction.resource.list ? (
                        <BreadcrumbLink asChild>
                          <Link
                            to={resourceAction.resource.list}
                            className="max-w-32 truncate sm:max-w-48"
                          >
                            {resourceAction.resource.meta?.label ??
                              resourceAction.resource.name}
                          </Link>
                        </BreadcrumbLink>
                      ) : (
                        <span className="max-w-32 truncate sm:max-w-48">
                          {resourceAction.resource.meta?.label ??
                            resourceAction.resource.name}
                        </span>
                      )}
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block">
                      /
                    </BreadcrumbSeparator>
                    <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
                      <BreadcrumbPage className="max-w-48 truncate">
                        {resourceAction.action === "create"
                          ? "إنشاء"
                          : resourceAction.action === "edit"
                            ? "تعديل"
                            : "التفاصيل"}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : (
                  <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
                    <BreadcrumbPage className="max-w-48 truncate">
                      {pageLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
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

function getResourceAction(pathname: string) {
  for (const resource of resources) {
    if (resource.create && matchesResourcePath(resource.create, pathname)) {
      return { resource, action: "create" as const };
    }
    if (resource.edit && matchesResourcePath(resource.edit, pathname)) {
      return { resource, action: "edit" as const };
    }
    if (resource.show && matchesResourcePath(resource.show, pathname)) {
      return { resource, action: "show" as const };
    }
  }
  return undefined;
}

function matchesResourcePath(route: string, pathname: string) {
  const routeParts = route.replace(/\/+$/, "").split("/");
  const pathParts = pathname.replace(/\/+$/, "").split("/");
  return (
    routeParts.length === pathParts.length &&
    routeParts.every(
      (part, index) => part.startsWith(":") || part === pathParts[index],
    )
  );
}

function getPageLabel(pathname: string) {
  if (pathname === "/settings") return "الإعدادات";
  if (pathname.startsWith("/catalog/promotions")) return "العروض والخصومات";
  if (pathname.startsWith("/catalog/settings/customization-fields"))
    return "خانات التخصيص";
  if (pathname.startsWith("/catalog/settings/story-goals"))
    return "أهداف التخصيص";
  if (pathname.startsWith("/catalog/settings/writing-dialects"))
    return "لهجات الكتابة";
  if (pathname.startsWith("/catalog/publisher-products"))
    return "منتجات الناشرين";
  if (pathname.startsWith("/catalog/addons")) return "الإضافات";
  if (pathname.startsWith("/catalog/products")) return "منتجات المنصة";
  if (pathname.startsWith("/orders")) return "الطلبات";
  if (pathname.startsWith("/notifications")) return "الإشعارات";
  if (pathname.startsWith("/users")) return "المستخدمون";
  if (pathname.startsWith("/profile")) return "الملف الشخصي";
  return "لوحة الإدارة";
}
