// Builds public/images/manifest.json from the photos in public/images/<section>/.
//   npm run images
// - Every .jpg/.jpeg/.png/.webp gets an entry with id "<section>.<file-name>", its size and a tiny blur placeholder.
// - Originals wider than 2400px are resized in place (next/image serves AVIF/WebP at the right size per device).
// - Hand-written fields (alt, focal, credit, source, license) are kept on re-runs. Entries whose file is gone are dropped.
// To swap in your own shoot: drop the new photo in with the same file name (or update "file"), then run the script.
import { readdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("public/images");
const MANIFEST = path.join(ROOT, "manifest.json");
const MAX_WIDTH = 2400;

type Entry = {
  id: string; file: string; alt: string; width: number; height: number; blurDataURL: string;
  focal?: string; credit?: string; source?: string; license?: string;
};

const current = JSON.parse(await readFile(MANIFEST, "utf8")) as { $comment?: string; images: Entry[] };
const previous = new Map(current.images.map((e) => [e.id, e]));
const next: Entry[] = [];

for (const section of (await readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  for (const name of (await readdir(path.join(ROOT, section))).sort()) {
    if (!/\.(jpe?g|png|webp)$/i.test(name)) continue;
    const abs = path.join(ROOT, section, name);
    const id = `${section}.${name.replace(/\.[^.]+$/, "")}`;

    let meta = await sharp(abs).metadata();
    if ((meta.width ?? 0) > MAX_WIDTH) {
      const tmp = `${abs}.tmp`;
      await sharp(abs).rotate().resize({ width: MAX_WIDTH }).jpeg({ quality: 86, mozjpeg: true }).toFile(tmp);
      await rename(tmp, abs);
      meta = await sharp(abs).metadata();
      console.log(`resized ${section}/${name} → ${meta.width}px`);
    }
    const blur = await sharp(abs).rotate().resize(16).blur(1).webp({ quality: 40 }).toBuffer();
    const old = previous.get(id);
    next.push({
      id,
      file: `/images/${section}/${name}`,
      alt: old?.alt ?? "",
      width: meta.width!,
      height: meta.height!,
      blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
      ...(old?.focal && { focal: old.focal }),
      ...(old?.credit && { credit: old.credit }),
      ...(old?.source && { source: old.source }),
      ...(old?.license && { license: old.license }),
    });
    if (!old?.alt) console.warn(`! ${id} has no alt text yet. Add it in manifest.json`);
  }
}

await writeFile(MANIFEST, JSON.stringify({ $comment: current.$comment, images: next }, null, 2) + "\n");
console.log(`manifest: ${next.length} images`);
