"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { isActive, type NavGroup } from "./app-sidebar";
import { useTheme } from "./theme";

// cmdk is only downloaded the first time someone opens the palette.
const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false });

export function SiteHeader({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { resolved, setTheme } = useTheme();

  const items = groups.flatMap((g) => g.items);
  const here = items.filter((i) => isActive(path, i.href)).sort((a, b) => b.href.length - a.href.length)[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLoaded(true);
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <p className="truncate text-sm font-medium">{here?.label ?? "Dashboard"}</p>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="hidden w-56 justify-start gap-2 font-normal text-muted-foreground sm:inline-flex"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
        >
          <Search aria-hidden />
          Go to…
          <Kbd className="ml-auto">Ctrl K</Kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          aria-label="Search"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
        >
          <Search aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
        >
          {resolved === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </Button>
      </div>
      {loaded && <CommandPalette open={open} onOpenChange={setOpen} groups={groups} />}
    </header>
  );
}
