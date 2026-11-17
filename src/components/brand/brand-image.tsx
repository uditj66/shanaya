import Image, { type ImageProps } from "next/image";
import manifest from "../../../public/images/manifest.json";
import { cn } from "@/lib/utils";

export type ImageEntry = {
  id: string;
  file: string;          // path under /public, e.g. /images/hero/treatment-room.jpg
  alt: string;
  width: number;
  height: number;
  blurDataURL: string;
  focal?: string;        // CSS object-position, e.g. "50% 30%"
  credit?: string;
  source?: string;
  license?: string;
};

const entries = (manifest as { images: ImageEntry[] }).images;
const byId = new Map(entries.map((e) => [e.id, e]));

export const imageEntry = (id: string) => byId.get(id) ?? null;

type Props = Omit<ImageProps, "src" | "alt" | "width" | "height" | "placeholder" | "blurDataURL"> & {
  /** Manifest id, e.g. "hero.treatment-room". Swap the photo by editing public/images/manifest.json. */
  id: string;
  /** Override the manifest alt text when the context needs a different description. */
  alt?: string;
};

/**
 * Every photo on the brand site goes through this: next/image (AVIF/WebP, responsive sizes, lazy by default),
 * blur placeholder, focal point and alt text from the manifest. Missing ids render a calm sand block, never a broken image.
 */
export function BrandImage({ id, alt, className, style, fill, sizes, ...rest }: Props) {
  const e = byId.get(id);
  if (!e) {
    return <span role="img" aria-label={alt ?? ""} className={cn("block bg-sand", fill && "absolute inset-0", className)} />;
  }
  const dims = fill ? { fill: true as const } : { width: e.width, height: e.height };
  return (
    <Image
      src={e.file}
      alt={alt ?? e.alt}
      {...dims}
      sizes={sizes ?? (fill ? "100vw" : undefined)}
      placeholder="blur"
      blurDataURL={e.blurDataURL}
      className={cn(fill && "object-cover", className)}
      style={{ objectPosition: e.focal, ...style }}
      {...rest}
    />
  );
}
