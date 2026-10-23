import type { RouterProvider } from "@refinedev/core";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";

export const authRouterProvider: RouterProvider = {
  go: function useGo() {
    const navigate = useNavigate();
    return ({ to = "/", type }) => {
      // Auth redirects are internal and fixed by our provider.
      const target = to === "/theme" ? "/theme" : "/sign-in";
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
    return () => ({ pathname: location.pathname });
  },
  Link: ({ to, children, ...props }) => <Link to={to} {...props}>{children}</Link>,
};
