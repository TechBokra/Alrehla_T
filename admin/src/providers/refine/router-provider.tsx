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
  const staticPath = [
    "/",
    "/sign-in",
    "/catalog/products",
    "/catalog/addons",
    "/notifications",
    "/uploads",
    "/users",
    "/profile",
    "/reset-password",
  ].includes(path);
  const productPath =
    path === "/catalog/products/create" ||
    /^\/catalog\/products\/[^/]+\/edit$/.test(path);
  return staticPath || productPath ? path : "/sign-in";
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
      const resource = resources.find((item) =>
        item.list === path ||
        (item.name === "personalized_products" &&
          (path === "/catalog/products/create" ||
            /^\/catalog\/products\/[^/]+\/edit$/.test(path))),
      );
      const editingProduct = /^\/catalog\/products\/([^/]+)\/edit$/.exec(path);
      const action = path === "/catalog/products/create"
        ? "create"
        : editingProduct
          ? "edit"
          : resource
            ? "list"
            : undefined;
      return {
        pathname: location.pathname,
        ...(resource && action
          ? { resource, action, ...(editingProduct ? { id: editingProduct[1] } : {}) }
          : {}),
      };
    };
  },
  Link: ({ to, children, ...props }) => (
    <Link to={to} {...props}>
      {children}
    </Link>
  ),
};
