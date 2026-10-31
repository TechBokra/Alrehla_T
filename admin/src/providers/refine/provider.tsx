import type { ReactNode } from "react";
import { Refine } from "@refinedev/core";
import { adminAuthProvider } from "./auth-provider";
import { arabicEgyptI18nProvider } from "./i18n-provider";
import { useNotificationProvider } from "./notification-provider";
import { authRouterProvider } from "./router-provider";
import { resources } from "./resources";
import { refineDataProviders } from "./data-provider";

export interface RefineProviderProps {
  children: ReactNode;
}

export function RefineProvider({ children }: RefineProviderProps) {
  const notificationProvider = useNotificationProvider();

  return (
    <Refine
      resources={resources}
      dataProvider={refineDataProviders}
      authProvider={adminAuthProvider}
      routerProvider={authRouterProvider}
      notificationProvider={notificationProvider}
      i18nProvider={arabicEgyptI18nProvider}
    >
      {children}
    </Refine>
  );
}
