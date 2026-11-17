# Placeholder photography: shortlist for approval

All picks are from **Pexels** (Pexels License: free for commercial use, no attribution required). Nothing has been downloaded yet.
Once approved, each photo is fetched at 2400px wide (`?auto=compress&cs=tinysrgb&w=2400`) into `public/images/<section>/<name>.jpg`,
then `npm run images` writes sizes, blur placeholders and alt text into `public/images/manifest.json`.
Estimated total: about 15–20 MB of JPEGs (next/image serves AVIF/WebP at the right size per device), plus a 4.2 MB hero video.

Unsplash was not used: its free spa results were dark, many were Unsplash+ (paid), and it showed a bot check.

| id | Pexels photo | Photographer | What it shows |
|---|---|---|---|
| hero.treatment-room | [7233271](https://www.pexels.com/photo/7233271/) | cottonbro studio | Therapist draping linen over a guest in a sunlit, airy spa room |
| hero.portrait | [35834876](https://www.pexels.com/photo/35834876/) | Satyam Pixels | South Asian woman with a white flower in her hair, glowing in sunlight |
| rituals.hands-facial | [13899862](https://www.pexels.com/photo/13899862/) | HONG SON | Beautician's hands working on a relaxed client's face |
| rituals.mask-application | [5659018](https://www.pexels.com/photo/5659018/) | Ivan S | Therapist brushing a white mask onto a client's face |
| rituals.massage | [5378218](https://www.pexels.com/photo/5378218/) | Engin Akyurt | Hot stones along a woman's back with white flowers |
| rituals.products | [11485121](https://www.pexels.com/photo/11485121/) | Andrzej Gdula | Amber serum bottle with small flowers on marble (no branding) |
| services.facials | [13899843](https://www.pexels.com/photo/13899843/) | HONG SON | Beautician applying skincare in a calm treatment room |
| services.medi-facials | [7446656](https://www.pexels.com/photo/7446656/) | Gustavo Fring | Aesthetician using a facial device in a white clinic |
| services.detan | [7479518](https://www.pexels.com/photo/7479518/) | Angela Roma | Close-up of glowing skin and a delicate nose ring |
| services.body-spa | [6629530](https://www.pexels.com/photo/6629530/) | Karolina Grabowska | Therapist placing hot stones during a back massage |
| services.body-polish | [7020265](https://www.pexels.com/photo/7020265/) | Yan Krukau | Body scrub on arms in a bright bathroom |
| services.hair-spa | [7755473](https://www.pexels.com/photo/7755473/) | RDNE Stock project | Hair wash at a white salon basin |
| services.nails | [6941115](https://www.pexels.com/photo/6941115/) | cottonbro studio | Soft nude manicure resting on white fabric |
| services.threading-waxing | [29588096](https://www.pexels.com/photo/29588096/) | Alexander Mass | Eyebrow shaping in a bright salon |
| services.glass-skin | [5846885](https://www.pexels.com/photo/5846885/) | Anna Tarazevich | Dewy skin beaded with water droplets |
| services.hydra | [7446664](https://www.pexels.com/photo/7446664/) | Gustavo Fring | Soothing facial treatment in a white room |
| services.bridal | [17499712](https://www.pexels.com/photo/17499712/) | Bonaventure Fernandez | Indian bride having make-up applied in window light |
| studios.reception | [17640379](https://www.pexels.com/photo/17640379/) | Rasul Abdurahimov | Ivory spa lounge with curved sofas |
| studios.treatment-suite | [6560308](https://www.pexels.com/photo/6560308/) | Anna Tarazevich | Treatment table by sunlit blinds |
| studios.lounge | [17640380](https://www.pexels.com/photo/17640380/) | Rasul Abdurahimov | Cream sofas in a sunlit spa lounge |
| studios.detail-marble | [9420380](https://www.pexels.com/photo/9420380/) | Skyler Ewing | Brass vase of fresh flowers on a pale glossy surface |
| studios.basin | [7755482](https://www.pexels.com/photo/7755482/) | RDNE Stock project | Guest relaxing during a hair wash (the empty-basin shots were dark) |
| studios.manicure-bar | [7755452](https://www.pexels.com/photo/7755452/) | RDNE Stock project | White manicure table with a plant |
| occasions.bridal | [29516470](https://www.pexels.com/photo/29516470/) | apertur 2.8 | Indian bride in jewellery being readied |
| occasions.festive | [20319221](https://www.pexels.com/photo/20319221/) | Abhijeet Gourav | Woman in an orange saree holding lit diyas |
| occasions.honeymoon | [7365434](https://www.pexels.com/photo/7365434/) | Sergey Torbik | Couple side by side during a spa massage |
| lookbook.01 – 06 | [7479960](https://www.pexels.com/photo/7479960/), [35267456](https://www.pexels.com/photo/35267456/), [41062014](https://www.pexels.com/photo/41062014/), [16157613](https://www.pexels.com/photo/16157613/), [34941685](https://www.pexels.com/photo/34941685/), [4857813](https://www.pexels.com/photo/4857813/) | various | Glowing skin, glossy hair, neutral manicures, serum still life |
| lookbook.pair1-before / after | [6925503](https://www.pexels.com/photo/6925503/) / [6925524](https://www.pexels.com/photo/6925524/) | Mike Murray | Same model, same mirror shot: sheet mask on, then fresh bare skin |
| gift.card | [7910900](https://www.pexels.com/photo/7910900/) | Ivan S | White tulips on a ribbon-tied gift box |
| cta.closing | [5659011](https://www.pexels.com/photo/5659011/) | Ivan S | Woman with eyes closed enjoying a gentle head massage |
| hero video (optional) | [8204101](https://www.pexels.com/video/8204101/) | ArtHouse Studio | Bright, calm facial cleanse; 720p file is 4.2 MB |

## Status (downloaded 2026-11-19)

- All 36 photos above are in `public/images/` (18 MB) with alt text, credit, source and licence in `manifest.json`.
- **Hero video: downloaded, reviewed, removed.** The person in the clip appears to be a man and the shot is a tight clinical close-up,
  which doesn't suit a women-focused, sunlit brand. The hero uses the still with a slow Ken Burns drift. To add a film later, drop a
  muted loop (under 5 MB) at `public/videos/hero.mp4` and pass `src="/videos/hero.mp4"` to `<HeroMedia>` on the home page.
- **Before/after pair: downloaded, unpublished.** The frames don't line up well enough to read as a comparison. The lookbook row
  ("Fresh, rested skin") is kept unpublished; the slider appears automatically once a published lookbook item has real before/after photos.

## Deliberately left out

- **Specialist portraits.** The only consistent set of South Asian portraits comes from an account named after a real competing salon chain, and they show real women who would appear on the site as named Lumière staff. The site shows a refined monogram for each specialist until the studios upload real team photos.
- **Before/after.** The one genuine same-shoot pair is a sheet-mask routine, not a Lumière treatment. If used, it stays flagged as a sample and is hidden on the live site; real, consented client photos should replace it.
