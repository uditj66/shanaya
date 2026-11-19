"use client";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CalendarPlus, Moon, Sun, Monitor } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "./ui/command";
import { NAV_ICONS, type NavGroup } from "./app-sidebar";
import { setTheme } from "./theme";

/** Ctrl/⌘ K: jump to any page you can see, or run a quick action. */
export function CommandPalette({ open, onOpenChange, groups }: { open: boolean; onOpenChange: (o: boolean) => void; groups: NavGroup[] }) {
  const router = useRouter();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href as Route);
  };
  const canBook = groups.some((g) => g.items.some((i) => i.href === "/dashboard/bookings"));
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Go to" description="Jump to a page or run an action">
      <CommandInput placeholder="Type a page or action…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        {canBook && (
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go("/dashboard/bookings/new")}>
              <CalendarPlus aria-hidden />
              New booking
            </CommandItem>
          </CommandGroup>
        )}
        {groups.map((g) => (
          <CommandGroup key={g.label} heading={g.label}>
            {g.items.map((it) => {
              const Icon = NAV_ICONS[it.icon];
              return (
                <CommandItem key={it.href} value={`${g.label} ${it.label}`} onSelect={() => go(it.href)}>
                  <Icon aria-hidden />
                  {it.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => { setTheme("light"); onOpenChange(false); }}><Sun aria-hidden />Light</CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); onOpenChange(false); }}><Moon aria-hidden />Dark</CommandItem>
          <CommandItem onSelect={() => { setTheme("system"); onOpenChange(false); }}><Monitor aria-hidden />System</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
