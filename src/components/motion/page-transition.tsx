import { ViewTransition } from "react";

/**
 * Wrap each brand page's content (in page.tsx, not a layout: layouts persist, so enter/exit never fire there).
 * Uses the browser View Transitions API through React; styles live in globals.css (.page-in / .page-out).
 * Browser back/forward and refreshes also cross-fade; reduced-motion users get an instant swap.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
