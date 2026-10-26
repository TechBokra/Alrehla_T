import type { ReactNode } from "react";
import { Refine } from "@refinedev/core";
import { toast } from "sonner";
import { Package, Store } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { adminAuthProvider } from "@/features/auth/supabase";
import { notificationsDataProvider } from "@/features/notifications/data-provider";
import { arabicEgyptI18nProvider } from "@/lib/i18n-provider";
import { previewDataProvider, previewRouterProvider } from "./demo-provider";
import { showcaseNavigation, type ShowcaseSection } from "./sections";

const resources = [
  {
    name: "products",
    list: "/",
    create: "/",
    edit: "/",
    clone: "/",
    show: "/",
    meta: {
      label: "المنتجات",
      icon: <Package className="size-4" />,
    },
  },
];

type ShowcaseLayoutProps = {
  activeSection: ShowcaseSection;
  children: ReactNode;
};

export function ShowcaseLayout({
  activeSection,
  children,
}: ShowcaseLayoutProps) {
  const activePage = showcaseNavigation.find(
    (item) => item.id === activeSection,
  );

  return (
    <Refine
      resources={resources}
      dataProvider={{
        default: previewDataProvider,
        notifications: notificationsDataProvider,
      }}
      authProvider={adminAuthProvider}
      routerProvider={previewRouterProvider}
      notificationProvider={{
        open: ({ message, description, type }) => {
          if (type === "error") toast.error(message, { description });
          else if (type === "progress") toast.loading(message, { description });
          else toast.success(message, { description });
        },
        close: (key) => toast.dismiss(key),
      }}
      i18nProvider={arabicEgyptI18nProvider}
      options={{
        disableTelemetry: true,
        disableRouteChangeHandler: true,
        syncWithLocation: false,
        title: {
          text: "الرحلة · لوحة الإدارة",
          icon: <Store className="size-5" />,
        },
      }}
    >
      <AdminLayout activeSection={activeSection} pageLabel={activePage?.label}>
        {children}
      </AdminLayout>
    </Refine>
  );
}
