import type { ResourceProps, RouterProvider } from "@refinedev/core";
import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { resources } from "./resources";

const staticPaths = ["/", "/sign-in", "/notifications", "/reset-password"];

function matchRoutePattern(pattern: string, path: string) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return undefined;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathPart;
    } else if (patternPart !== pathPart) {
      return undefined;
    }
  }
  return params;
}

function findResourceAction(path: string) {
  for (const resource of resources) {
    for (const action of ["create", "edit", "show"] as const) {
      const route = resource[action];
      if (!route) continue;
      const params = matchRoutePattern(route, path);
      if (params) return { resource, action, params };
    }
  }
  return undefined;
}

export function resolveAdminPath(to: string) {
  const path = to.replace(/\/+$/, "") || "/";
  const registeredListPath = resources.some((resource) => resource.list === path);
  return staticPaths.includes(path) || registeredListPath || findResourceAction(path)
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
      const resourceAction = findResourceAction(path);
      const listResource = resources.find((item) => item.list === path);
      return {
        pathname: location.pathname,
        ...(resourceAction
          ? {
              resource: resourceAction.resource,
              action: resourceAction.action,
              ...(resourceAction.params.id ? { id: resourceAction.params.id } : {}),
            }
          : listResource
            ? { resource: listResource, action: "list" }
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
