# Personal Developer Portfolio

Vite + React 18 portfolio. The whole site reads content from `src/data/*` so you
can rewrite copy and data without touching components.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build
npm run preview  # preview the production build
```

## Edit content

Replace the clearly marked `PLACEHOLDER` copy in:

| File | Used for |
| --- | --- |
| `src/data/profile.js` | Name, title, tagline, location, email, social links, about paragraphs, resume path, section flags |
| `src/data/skills.js` | Six skill groups and their chips |
| `src/data/services.js` | Services offered (section currently hidden) |
| `src/data/projects.js` | Project cards and detail data |
| `src/data/experience.js` | Work history — **not rendered**; no Work tab exists |
| `src/data/education.js` | Degree entry for the Education tab |
| `src/data/training.js` | Training programs for the Training tab |
| `src/data/testimonials.js` | Testimonials slider (section currently hidden) |
| `src/data/blog.js` | Blog list and posts (section currently hidden) |

Stat cards are **not** stored as literals — `src/data/stats.js` counts them from
the real files (years from `education.js`, count from `training.js`, count from
`projects.js`, chip count from the Programming Languages group in `skills.js`), so
they stay correct when you edit the data.

Replace `src/assets/profile.png` with your photo (keep the same filename), then
re-run `npm run optimize:images` to regenerate the responsive WebP variants in
`public/`. The hero renders them through a `<picture>` element, so mobile loads
the small file and retina screens get the 2× one. The blog post cover images
live in `src/assets/blog/` and the project cover images live in
`src/assets/projects/`.

## Images you must replace

| File | What it is | How to replace |
| --- | --- | --- |
| `public/og-image.png` | Open Graph / Twitter card image, 1200×630 | **Required.** It is a clearly marked `PLACEHOLDER`. Drop your own 1200×630 PNG over it, then run `npm run optimize:images` (or just overwrite the file — it is served as-is). |
| `src/assets/profile.png` | Your real photo | Already yours. Re-run `npm run optimize:images` after replacing it. |

## Theme

Dark is the default. Preference is stored in `localStorage` under the `theme`
key. A no-flash inline script in `index.html` applies the saved class before
the first paint.

## Contact form

Set `VITE_CONTACT_ENDPOINT` in `.env` to a Formspree-style endpoint to receive
real submissions. If the variable is empty (the default), the form falls back
to opening the user's mail client with a prefilled message. See
`.env.example`.

## Pre-launch checklist

Run `npm run check:content` before every deploy. It exits non-zero until all of
these are done:

1. **Replace every `PLACEHOLDER` in `src/data/*.js`.** The list it prints is the
   exact to-do list. `profile.sections` lets you hide a section whose data you
   have not written yet — that is why blog / services / testimonials still show
   up in the output.
2. **Add `public/resume.pdf`.** The hero "Download Resume" button and the Resume
   section both link to it. The path is a single constant,
   `RESUME_URL` in `src/data/profile.js`. `check:content` warns while the file is
   missing. **We do not generate this file — it is yours to add.**
3. **Replace `public/og-image.png`** with your own 1200×630 image.
4. **Set `VITE_SITE_URL`** in `.env` before building. Without it the canonical
   link, Open Graph tags and `sitemap.xml` all fall back to `https://example.com`.
5. **Add real project screenshots** to `src/assets/projects/<slug>.webp`, run
   `npm run optimize:images`, then point the project's `image` field at the
   generated path in `public/projects/`.

## Sections on / off

`src/data/profile.js` has a `sections` flag:

```js
sections: {
  testimonials: false,
  blog: false,
  services: false,
},
```

Setting one to `false` removes that section from the Home page, the Navbar links,
the Footer links, and `sitemap.xml`. The component and its data file stay in the
repo — nothing is deleted.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | sitemap + meta injection, then the production build |
| `npm run preview` | Serve `dist/` locally |
| `npm run check:content` | Lists every remaining `PLACEHOLDER` / `Lorem` / `example.com` / `Founder Name` with `file:line`. Exits non-zero while any remain. |
| `npm run optimize:images` | Regenerates the responsive WebP/PNG variants in `public/`, the OG placeholder, and the favicon PNGs. |
| `npm run sitemap` | Regenerate `public/sitemap.xml` + `public/robots.txt` on their own. |
| `npm run axe` | axe-core audit across routes × themes × Chromium/Firefox. |
| `npm run lighthouse` | Lighthouse mobile + desktop on `/`, `/blog`, `/projects/<slug>`. |

The axe and Lighthouse scripts expect `npm run preview` to be serving on
port 4173. The `verify*.mjs` / `probe-*.mjs` scripts write screenshots and logs
into `verification/` and are not part of the runtime build.

## Environment

Copy `.env.example` to `.env` and fill in `VITE_SITE_URL` — it drives the
canonical link, Open Graph tags, `sitemap.xml` and `robots.txt`. Without it the
build falls back to `https://example.com`, so **set it before your first real
build**. `VITE_SITE_NAME` and `VITE_CONTACT_ENDPOINT` are optional.

## SPA routing on static hosts

Direct visits to `/blog/<slug>` and `/projects/<slug>` need a rewrite to
`index.html`. Configs for the common hosts are already in the repo:

- `vercel.json` — Vercel
- `public/_redirects` — Netlify
- `netlify.toml` — Netlify (build settings + redirect)
# kamrul-portfolio
