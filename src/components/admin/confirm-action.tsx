"use client";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { buttonVariants } from "./ui/button";
import { Spinner } from "./ui/spinner";

/**
 * Asks before doing something hard to undo (refunds, cancellations, deletes).
 * `onConfirm` is usually a server action; return a string to show it as an error toast.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  confirmDisabled = false,
  success,
  onConfirm,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** Keep the confirm button off until the dialog has what it needs (e.g. a loaded amount). */
  confirmDisabled?: boolean;
  success?: string;
  onConfirm: () => Promise<unknown> | unknown;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || confirmDisabled}
            className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  const res = await onConfirm();
                  if (typeof res === "string" && res) toast.error(res);
                  else if (res && typeof res === "object" && "error" in res && res.error) toast.error(String(res.error));
                  else if (success) toast.success(success);
                  setOpen(false);
                } catch (err) {
                  // redirect() from a server action throws on purpose; let Next handle it.
                  if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) throw err;
                  toast.error(err instanceof Error ? err.message : "Something went wrong");
                }
              });
            }}
          >
            {pending && <Spinner />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
