# Szalat Lab website

## Stack
- Astro (static output, TypeScript strict), deployed to GitHub Pages via GitHub Actions.
- Plain CSS: tokens in `src/styles/global.css`, component-scoped `<style>`. No Tailwind or UI frameworks.
- Allowed deps: Astro (+ official integrations), one BibTeX parser, `@fontsource*`. Ask before adding others.

## Commands
- `npm run dev`: local dev server
- `npm run build`: must pass with zero errors and warnings before committing
- `npm run preview`: serve the built site at http://localhost:4321/

## Content locations
- Site text (mission, overview, affiliations) and nav: `src/site.config.ts`
- People: `src/content/people/*.md`; Research areas: `src/content/research/*.md`
- Publications: `src/data/publications.bib` (source of truth; never scrape Google Scholar).
  `note = {Abstract}` → Abstracts & posters section; `keywords = {featured}` → Home page list
- Photos: `src/assets/people/`
- `site` / `base` (domain, repo path): `astro.config.mjs` only

## Design rules
- Dark theme only. Neutrals + one accent (aqua `#5CD6CB`). Use tokens, never raw hex in components.
- Multi-color `--omics-*` palette is for the decorative Home background only, not UI.
- Inter for body text, IBM Plex Mono for labels, dates, and metadata. Self-hosted.
- Motion: hover/focus transitions ≤200 ms only. No scroll effects, parallax, carousels, or animation.
- Prose ≤72ch. Must work from 360 px wide. WCAG 2.1 AA contrast, visible focus, alt text on all images.
- Lighthouse 95+ in all categories on every page.

## Conventions
- Internal links go through `url()` in `src/lib/url.ts` (base-aware). Never hard-code `/path`.
- Pages use `BaseLayout` with a `title` and `description`.
- Client JS only where essential (publication filter). Content must render without JS.
- Mark uncertain or placeholder content with a `TODO` comment.
- Research: describe questions and methods only. No unpublished findings.
