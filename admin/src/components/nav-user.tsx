import { useTheme } from "@/components/refine-ui/theme/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLogout } from "@refinedev/core";
import {
  LoaderCircle,
  LogOut,
  Moon,
  Settings2,
  Sun,
  UserRound,
} from "lucide-react";
import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Switch } from "./ui/switch";

type UserIdentity = {
  name?: string;
  email?: string;
  avatar?: string;
};

type NavUserProps = {
  user: UserIdentity;
  signOut?: () => void;
};

type ActiveDialog = "profile" | "settings" | null;

const signOutMessage =
  "تم تسجيل الخروج التجريبي. لا توجد جلسة دخول حقيقية في المعاينة.";

export function NavUser({ user, signOut }: NavUserProps) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const themeSwitchId = useId();
  const darkModeEnabled =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : theme === "dark";

  const name = user.name?.trim() || "مشرف تجريبي";
  const email = user.email?.trim() || "admin@example.test";
  const avatar = user.avatar?.trim();

  const handleSignOut = () => {
    if (isLoggingOut) return;

    if (signOut) {
      signOut();
      toast.info(signOutMessage);
      return;
    }

    logout(
      { redirectPath: false },
      {
        onSuccess: () => toast.info(signOutMessage),
        onError: () => toast.error("تعذّر إكمال تسجيل الخروج التجريبي."),
      }
    );
  };

  const avatarMark = (
    <Avatar className="size-8 rounded-lg">
      {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
      <AvatarFallback className="rounded-lg">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={isLoggingOut}
              tooltip={name}
              aria-label={`قائمة المستخدم ${name}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {avatarMark}
              <div className="grid min-w-0 flex-1 text-right text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64"
            side={isMobile ? "bottom" : "left"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-right text-sm">
                {avatarMark}
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => setActiveDialog("profile")}>
                <UserRound />
                الملف الشخصي
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setActiveDialog("settings")}>
                <Settings2 />
                الإعدادات
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup className="flex min-h-9 items-center gap-2 px-2">
              <Sun
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <DropdownMenuItem
                asChild
                onSelect={(event) => event.preventDefault()}
                className="min-h-0 rounded-full p-0 focus:bg-transparent focus:text-foreground"
              >
                <Switch
                  id={themeSwitchId}
                  role="menuitemcheckbox"
                  aria-label="الوضع الداكن"
                  checked={darkModeEnabled}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                  className="shrink-0"
                />
              </DropdownMenuItem>
              <Moon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={isLoggingOut}
                onSelect={handleSignOut}
              >
                {isLoggingOut ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <LogOut />
                )}
                {isLoggingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "P";
  const last = words.length > 1 ? words.at(-1)?.[0] : "A";
  return `${first}${last ?? ""}`.toUpperCase();
}
