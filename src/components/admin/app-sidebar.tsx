"use client";
import { useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Activity, CalendarDays, Check, ChartLine, ChevronsUpDown, CreditCard, Crown, Gift, Globe, Inbox, LayoutDashboard, ListChecks,
  LogOut, PhoneCall, Settings, Sparkles, Store, UserRound, Users,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "./ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { THEME_OPTIONS, useTheme, type ThemeChoice } from "./theme";
import { cn } from "@/lib/utils";

export const NAV_ICONS = {
  LayoutDashboard, CalendarDays, ListChecks, Users, Inbox, PhoneCall, Globe, ChartLine, Sparkles, UserRound, Settings, Activity, Gift, CreditCard, Crown,
};
export type NavItem = { href: string; label: string; icon: keyof typeof NAV_ICONS; badge?: number; tone?: "accent" | "danger" };
export type NavGroup = { label: string; items: NavItem[] };
export type StudioOption = { id: string; label: string; city: string };

export function isActive(path: string, href: string) {
  return href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`);
}

export function AppSidebar({
  brand,
  groups,
  studios,
  current,
  allowAll,
  user,
  signOut,
  switchSalon,
}: {
  brand: string;
  groups: NavGroup[];
  studios: StudioOption[];
  current: string;
  allowAll: boolean;
  user: string;
  signOut: () => Promise<void>;
  switchSalon: (id: string) => Promise<void>;
}) {
  const path = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <StudioSwitcher brand={brand} studios={studios} current={current} allowAll={allowAll} switchSalon={switchSalon} />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map((it) => {
                const Icon = NAV_ICONS[it.icon];
                const on = isActive(path, it.href);
                return (
                  <SidebarMenuItem key={it.href}>
                    <SidebarMenuButton asChild isActive={on} tooltip={it.label}>
                      <Link href={it.href as Route} onClick={close} aria-current={on ? "page" : undefined}>
                        <Icon aria-hidden />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {!!it.badge && (
                      <SidebarMenuBadge
                        className={cn(
                          "rounded-full px-1.5",
                          it.tone === "danger" ? "bg-destructive/12 text-destructive" : "bg-primary/12 text-primary",
                        )}
                      >
                        {it.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} signOut={signOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function StudioSwitcher({
  brand,
  studios,
  current,
  allowAll,
  switchSalon,
}: {
  brand: string;
  studios: StudioOption[];
  current: string;
  allowAll: boolean;
  switchSalon: (id: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const { isMobile } = useSidebar();
  const cities = [...new Set(studios.map((s) => s.city))];
  const label = current === "all" ? `All studios (${studios.length})` : (studios.find((s) => s.id === current)?.label ?? "Studio");
  const single = studios.length < 2 && !allowAll;

  const button = (
    <SidebarMenuButton size="lg" disabled={pending} className="data-[state=open]:bg-sidebar-accent" tooltip={single ? undefined : "Switch studio"}>
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Store className="size-4" aria-hidden />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-semibold text-sidebar-accent-foreground">{brand}</span>
        <span className="truncate text-xs">{label}</span>
      </div>
      {!single && <ChevronsUpDown className="ml-auto" aria-hidden />}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {single ? (
          button
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-60" align="start" side={isMobile ? "bottom" : "right"} sideOffset={4}>
              {allowAll && (
                <>
                  <DropdownMenuItem onSelect={() => start(() => switchSalon("all"))}>
                    All studios ({studios.length})
                    {current === "all" && <Check className="ml-auto" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {cities.map((c) => (
                <DropdownMenuGroup key={c}>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{c}</DropdownMenuLabel>
                  {studios
                    .filter((s) => s.city === c)
                    .map((s) => (
                      <DropdownMenuItem key={s.id} onSelect={() => start(() => switchSalon(s.id))}>
                        {s.label}
                        {current === s.id && <Check className="ml-auto" aria-hidden />}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserMenu({ user, signOut }: { user: string; signOut: () => Promise<void> }) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const initials = user.slice(0, 2).toUpperCase() || "ME";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" tooltip="Account">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-sidebar-accent-foreground">{user.split("@")[0]}</span>
                <span className="truncate text-xs">{user}</span>
              </div>
              <ChevronsUpDown className="ml-auto" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon aria-hidden />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
