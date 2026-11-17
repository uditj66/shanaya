"use client";
import Link from "next/link";
import { brandHref } from "@/lib/brand/href";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { BrandImage } from "@/components/brand/brand-image";
import { BeforeAfter } from "@/components/motion/before-after";
import { ClipReveal } from "@/components/motion/clip-reveal";
import { CursorPreview } from "@/components/motion/cursor-preview";
import { Magnetic } from "@/components/motion/magnetic";
import { MaskLines } from "@/components/motion/mask-lines";
import { KenBurns, Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Badge, Card, Divider, Eyebrow, Price, Rating, Skeleton } from "@/components/ui/display";
import { Checkbox, Field, Input, Label, RadioCard, RadioGroup, Select, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, DialogTrigger, SheetContent, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";

function DemoLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 text-[0.8125rem] text-stone">{children}</p>;
}

/* ─────────────────────────────── Motion ─────────────────────────────── */
export function MotionDemos() {
  return (
    <div className="mt-16 grid gap-20 md:mt-24 md:gap-28">
      <div>
        <DemoLabel>Mask lines: headline rises line by line out of a soft mask (scroll to replay on reload)</DemoLabel>
        <MaskLines as="p" lines={["Skin, in its", "finest light."]} className="display-cut text-display-l" />
      </div>

      <div className="grid gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <DemoLabel>Clip-path wipe with settle-in zoom</DemoLabel>
          <ClipReveal className="aspect-[4/5] md:aspect-[5/4]">
            <BrandImage id="rituals.hands-facial" fill sizes="(min-width: 768px) 55vw, 100vw" className="bg-blush" />
          </ClipReveal>
        </div>
        <div className="md:col-span-5">
          <DemoLabel>Scroll parallax with gentle scale</DemoLabel>
          <Parallax className="aspect-[3/4]" strength={0.1} zoom>
            <BrandImage id="studios.reception" fill sizes="(min-width: 768px) 40vw, 100vw" className="bg-sand" />
          </Parallax>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <DemoLabel>Ken Burns (CSS, 18s, paused for reduced motion)</DemoLabel>
          <KenBurns className="aspect-[16/10] rounded-[var(--radius-image)]">
            <BrandImage id="hero.treatment-room" fill sizes="(min-width: 768px) 45vw, 100vw" className="bg-champagne/50" />
          </KenBurns>
        </div>
        <div>
          <DemoLabel>Before / after (drag, or focus and use arrow keys)</DemoLabel>
          <BeforeAfter
            className="aspect-[16/10]"
            label="Compare skin before and after the Korean Glass Skin Facial"
            before={<BrandImage id="lookbook.glass-skin-before" fill sizes="(min-width: 768px) 45vw, 100vw" className="bg-sand" />}
            after={<BrandImage id="lookbook.glass-skin-after" fill sizes="(min-width: 768px) 45vw, 100vw" className="bg-blush" />}
          />
        </div>
      </div>

      <div>
        <DemoLabel>Cursor-follow preview (desktop with a mouse; a clean list on touch)</DemoLabel>
        <CursorPreview
          items={[
            { key: "glass", href: brandHref("/styleguide"), eyebrow: "Luxury facial", title: "Korean Glass Skin Facial", meta: "from ₹3,499 · 1 hr 15 min", media: <BrandImage id="services.glass-skin" fill sizes="240px" className="bg-blush" /> },
            { key: "hydra", href: brandHref("/styleguide"), eyebrow: "Luxury facial", title: "HydraGlow Ritual", meta: "from ₹4,299 · 1 hr", media: <BrandImage id="services.hydra" fill sizes="240px" className="bg-sand" /> },
            { key: "bridal", href: brandHref("/styleguide"), eyebrow: "Occasion", title: "Royal Bridal Glow", meta: "from ₹14,999 · 4 visits", media: <BrandImage id="services.bridal" fill sizes="240px" className="bg-champagne" /> },
            { key: "hair", href: brandHref("/styleguide"), eyebrow: "Hair", title: "Botanical Hair Spa", meta: "from ₹1,999 · 1 hr", media: <BrandImage id="services.hair-spa" fill sizes="240px" className="bg-linen" /> },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <DemoLabel>Magnetic button (6px pull, mouse only)</DemoLabel>
        <Magnetic>
          <Button size="lg">
            Book a ritual <ArrowRight strokeWidth={1.5} />
          </Button>
        </Magnetic>
      </div>
    </div>
  );
}

/* ───────────────────────────── Components ───────────────────────────── */
const schema = z.object({
  name: z.string().trim().min(2, "Please tell us your name"),
  phone: z.string().trim().regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  studio: z.string().min(1, "Choose a studio"),
  notes: z.string().max(500).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree so we can contact you about this booking" }) }),
});
type FormValues = z.infer<typeof schema>;

const studios = [
  { value: "bandra-west", label: "Mumbai · Bandra West" },
  { value: "khan-market", label: "New Delhi · Khan Market" },
  { value: "indiranagar", label: "Bengaluru · Indiranagar" },
  { value: "park-street", label: "Kolkata · Park Street" },
];

export function ComponentDemos() {
  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", studio: "", notes: "" },
  });
  const onSubmit = (v: FormValues) => {
    toast("Request received", { description: `Thank you, ${v.name.split(" ")[0]}. This is a demo, so nothing was sent.`, tone: "success" });
    reset();
  };

  return (
    <div className="grid gap-20 md:gap-28">
      {/* Buttons */}
      <div>
        <DemoLabel>Buttons: one primary per view; quiet for the second action; link for inline</DemoLabel>
        <div className="flex flex-wrap items-center gap-4">
          <Button>Book a ritual</Button>
          <Button variant="quiet">Find your studio</Button>
          <Button variant="soft">View menu</Button>
          <Button variant="link">Read the story</Button>
          <Button size="sm" variant="quiet">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <Button asChild variant="quiet">
            <Link href={brandHref("/styleguide#colour")}>As a link</Link>
          </Button>
        </div>
        <div className="mt-6 inline-flex rounded-2xl bg-charcoal/80 p-6">
          <Button variant="light">On photography</Button>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <Eyebrow>Forms</Eyebrow>
          <p className="mt-4 text-stone">
            React Hook Form + Zod. Labels are always visible, errors are announced, and every target is at least 44px tall.
            Submit empty to see validation.
          </p>
        </div>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:col-span-8 md:grid-cols-2">
          <Field label="Your name" error={formState.errors.name?.message}>
            {(a) => <Input {...a} {...register("name")} autoComplete="name" placeholder="Ananya Rao" />}
          </Field>
          <Field label="Mobile number" hint="We'll only use it for this booking" error={formState.errors.phone?.message}>
            {(a) => <Input {...a} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" />}
          </Field>
          <Field label="Studio" error={formState.errors.studio?.message}>
            {(a) => (
              <Controller
                control={control}
                name="studio"
                render={({ field }) => <Select {...a} placeholder="Choose a studio" options={studios} value={field.value} onValueChange={field.onChange} />}
              />
            )}
          </Field>
          <Field label="Anything we should know?" hint="Skin concerns, allergies, an occasion" className="md:row-span-2">
            {(a) => <Textarea {...a} {...register("notes")} />}
          </Field>
          <div className="grid gap-2">
            <Controller
              control={control}
              name="consent"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true ? true : undefined)}
                    aria-invalid={formState.errors.consent ? true : undefined}
                    aria-describedby={formState.errors.consent ? "consent-error" : undefined}
                    className="mt-0.5"
                  />
                  <Label htmlFor="consent" className="font-normal leading-relaxed text-stone">
                    I agree to be contacted by Lumière about this request.
                  </Label>
                </div>
              )}
            />
            {formState.errors.consent && (
              <p id="consent-error" role="alert" className="text-[0.8125rem] text-danger">{formState.errors.consent.message}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={formState.isSubmitting}>Request a call-back</Button>
          </div>
        </form>
      </div>

      {/* Radio cards */}
      <div>
        <DemoLabel>Radio cards (time slots, studios, specialists): arrow keys move between options</DemoLabel>
        <RadioGroup defaultValue="11:30" aria-label="Choose a time" className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {["10:00", "10:45", "11:30", "13:15", "15:00", "17:30"].map((t) => (
            <RadioCard key={t} value={t} disabled={t === "13:15"} className="py-3 text-center text-sm tabular-nums">
              {t}
            </RadioCard>
          ))}
        </RadioGroup>
      </div>

      {/* Tabs + overlays */}
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <DemoLabel>Tabs</DemoLabel>
          <Tabs defaultValue="facials">
            <TabsList aria-label="Treatment categories">
              <TabsTrigger value="facials">Facials</TabsTrigger>
              <TabsTrigger value="body">Body & spa</TabsTrigger>
              <TabsTrigger value="hair">Hair</TabsTrigger>
              <TabsTrigger value="hands">Hands & feet</TabsTrigger>
            </TabsList>
            <TabsContent value="facials" className="pt-6 text-stone">Seven luxury facials and five physician-led medi-facials.</TabsContent>
            <TabsContent value="body" className="pt-6 text-stone">Massages, polishing and body rituals.</TabsContent>
            <TabsContent value="hair" className="pt-6 text-stone">Hair spa, smoothing and scalp rituals.</TabsContent>
            <TabsContent value="hands" className="pt-6 text-stone">Manicures and pedicures, from classic to spa.</TabsContent>
          </Tabs>
        </div>
        <div>
          <DemoLabel>Dialog, sheet and tooltip (Esc closes, focus is trapped and returned)</DemoLabel>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="quiet">Open dialog</Button>
              </DialogTrigger>
              <DialogContent title="Cancellation policy" description="Free cancellation or rescheduling up to 4 hours before your appointment.">
                <DialogClose asChild>
                  <Button>Understood</Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="quiet">Open sheet</Button>
              </DialogTrigger>
              <SheetContent title="Your booking" description="Korean Glass Skin Facial · Bandra West">
                <div className="grid gap-4 pt-4">
                  <Price amount={3499} minutes={75} />
                  <Divider />
                  <p className="text-stone">On phones this panel becomes a bottom sheet in the booking flow.</p>
                </div>
              </SheetContent>
            </Dialog>
            <Tooltip content="Prices are the same at every studio and exclude GST.">
              <Button variant="link">Why this price?</Button>
            </Tooltip>
            <Button variant="soft" onClick={() => toast("Saved to your wishlist", { description: "Korean Glass Skin Facial" })}>
              Show toast
            </Button>
          </div>
        </div>
      </div>

      {/* Display */}
      <div className="grid gap-8 md:grid-cols-3">
        <Reveal index={0}>
          <Card>
            <div className="flex flex-wrap gap-2">
              <Badge>Facial</Badge>
              <Badge tone="accent">Bestseller</Badge>
              <Badge tone="brass">Signature</Badge>
            </div>
            <h3 className="display-cut mt-5 text-h3">Korean Glass Skin Facial</h3>
            <Price className="mt-2" amount={3499} from minutes={75} />
            <Rating className="mt-4" value={4.8} count={1240} />
          </Card>
        </Reveal>
        <Reveal index={1}>
          <Card>
            <Eyebrow>Status</Eyebrow>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="success">Confirmed</Badge>
              <Badge tone="danger">Cancelled</Badge>
              <Badge tone="neutral">Consultation first</Badge>
            </div>
            <Divider className="my-6" ornament />
            <p className="text-sm text-stone">Badges never rely on colour alone; the word carries the meaning.</p>
          </Card>
        </Reveal>
        <Reveal index={2}>
          <Card aria-busy="true" aria-label="Loading example">
            <Skeleton className="aspect-[4/3]" />
            <Skeleton className="mt-5 h-6 w-3/4" />
            <Skeleton className="mt-3 h-4 w-1/2" />
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
