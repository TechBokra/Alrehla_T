import type { ReactNode } from "react";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ShowcaseSection } from "@/features/component-showcase/sections";
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
    <SidebarProvider defaultOpen>
      <AppSidebar
        activeSection={activeSection}
        user={user}
        logOut={logout}
        isLoggingOut={isLoggingOut}
      />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-sidebar-border bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="h-5" />
            <div className="hidden text-sm text-muted-foreground sm:block">
              نظام الإدارة <span className="px-1.5">/</span>
              <span className="font-medium text-foreground">
                {pageLabel ?? "معرض المكوّنات"}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-12 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
