import type { RouterProvider } from "@refinedev/core";
import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { resources } from "./resources";

export function resolveAdminPath(to: string) {
  const path = to.replace(/\/+$/, "") || "/";
  return [
    "/",
    "/sign-in",
    "/catalog/products",
    "/catalog/addons",
    "/notifications",
    "/uploads",
    "/users",
    "/profile",
    "/reset-password",
  ].includes(path)
    ? path
    : "/sign-in";
}

export const authRouterProvider: RouterProvider = {
  go: function useGo() {
    const navigate = useNavigate();
    return ({ to = "/", type }) => {
      const target = resolveAdminPath(to);
      if (type === "path") return target;
      void navigate({ to: target, replace: type === "replace" });
    };
  },
  back: function useBack() {
    const router = useRouter();
    return () => router.history.back();
  },
  parse: function useParse() {
    const location = useLocation();
    return () => {
      const path = location.pathname.replace(/\/+$/, "");
      const resource = resources.find((item) => item.list === path);
      return {
        pathname: location.pathname,
        ...(resource ? { resource, action: "list" as const } : {}),
      };
    };
  },
  Link: ({ to, children, ...props }) => (
    <Link to={to} {...props}>
      {children}
    </Link>
  ),
};
