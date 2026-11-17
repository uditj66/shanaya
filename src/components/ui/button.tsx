import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2.5 whitespace-nowrap font-sans font-medium tracking-[0.02em] select-none",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--duration-ui)] ease-[var(--ease-ui)]",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** The one strong action per view. */
        primary: "rounded-full bg-charcoal text-ivory hover:bg-[#3a3230] hover:shadow-soft",
        /** Secondary action: hairline outline. */
        quiet: "rounded-full border border-charcoal/25 bg-transparent text-charcoal hover:border-charcoal hover:bg-ivory",
        /** Calm filled action on ivory sections. */
        soft: "rounded-full bg-linen text-charcoal hover:bg-sand",
        /** On top of photography. */
        light: "rounded-full bg-ivory/92 text-charcoal backdrop-blur-sm hover:bg-ivory",
        /** Inline text action with a drawn underline. */
        link: [
          "relative rounded-none px-0 text-charcoal",
          "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-current",
          "after:transition-transform after:duration-500 after:ease-[var(--ease-out-soft)] hover:after:scale-x-[0.35]",
        ],
      },
      size: {
        sm: "min-h-9 px-4 text-[0.8125rem]",
        md: "min-h-11 px-6 text-sm",
        lg: "min-h-13 px-8 text-[0.9375rem]",
        icon: "size-11 rounded-full p-0",
      },
    },
    compoundVariants: [{ variant: "link", className: "min-h-11 px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a <Link>) with button styling. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
