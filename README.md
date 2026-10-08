# Szalat Lab website

Source for **https://szalat-lab.github.io/**, the website of the Szalat Lab (Raphael E. Szalat, MD, PhD) at Boston
Medical Center and the Boston University Chobanian & Avedisian School of Medicine.

The site rebuilds and publishes itself automatically a minute or two after any change is saved to the `main` branch.
**You never need to touch code to update content.** Every common change is one file, described below.

- [Edit a file on GitHub](#edit-a-file-on-github)
- [Add a person](#add-a-person)
- [Add a research area](#add-a-research-area)
- [Add a paper](#add-a-paper)
- [Feature a paper on the home page](#feature-a-paper-on-the-home-page)
- [Add a collaborator](#add-a-collaborator)
- [Add or change a concept](#add-or-change-a-concept)
- [Change site-wide text](#change-site-wide-text)
- [For developers](#for-developers)

---

## Edit a file on GitHub

1. Open the file on github.com (links are in each section below).
2. Click the **pencil icon** (Edit this file).
3. Make your change.
4. Click **Commit changes…**, write a short note such as "Add Jane Doe", and commit to `main`.
5. Wait about two minutes, then reload the website. Progress is visible under the repository's **Actions** tab;
   a red ✗ means something is wrong with the file (the error message says which line).

To add a **new** file, open the folder on GitHub and choose **Add file → Create new file**.
To upload a **photo**, open the folder and choose **Add file → Upload files**.

---

## Add a person

Each person is one file in [`src/content/people/`](src/content/people/). The file name becomes part of the page
address, so use lowercase and hyphens: `jane-doe.md`.

1. Upload their photo (JPG, PNG, or AVIF, any size) to [`src/assets/people/`](src/assets/people/), named like
   `jane-doe.jpg`. Skip this if there is no photo; a placeholder with their initials is shown instead.
2. Create `src/content/people/jane-doe.md` and paste:

```markdown
---
name: Jane Doe
credentials: PhD
role: Postdoctoral Fellow
group: postdoc
order: 1
shortBio: One or two sentences shown on the card.
photo: ../../assets/people/jane-doe.jpg
photoAlt: Portrait of Jane Doe
pubNames: ["Doe, J"]
email: jane.doe@bmc.org
orcid: 0000-0000-0000-0000
scholar: https://scholar.google.com/citations?user=XXXX
github: https://github.com/janedoe
linkedin: https://www.linkedin.com/in/janedoe/
website: https://example.org
---

The full bio goes here. It appears when someone clicks "Full bio". Write as many paragraphs as you like;
leave a blank line between paragraphs.
```

| Field | Required | Notes |
|---|---|---|
| `name`, `role`, `group`, `shortBio` | yes | |
| `group` | yes | One of `pi`, `postdoc`, `staff`, `md-phd`, `grad`, `undergrad`, `alumni`. Controls the section and order on the People page. |
| `order` | no | Sorting within a group; smaller numbers first. |
| `photo`, `photoAlt` | no | `photoAlt` describes the photo for screen readers. |
| `photoPosition` | no | Where to crop: `attention` (default, finds the face), `top`, `center`, `bottom`, `left`, `right`. |
| `pubNames` | no | How the name appears in `publications.bib`, so the person is **bolded** in publication lists. Use `"Doe, J"` (surname + first initial) for common surnames, or just `"Doe"`. |
| `email`, `orcid`, `scholar`, `github`, `linkedin`, `website` | no | Delete any line you don't need. |

**When someone leaves:** change `group:` to `alumni` and optionally add `alumniNote: Now at Example University`.
Alumni are listed last and are no longer bolded in publications.

---

## Add a research area

Each area is one file in [`src/content/research/`](src/content/research/). The file name becomes the link anchor
(`/research/#file-name`).

```markdown
---
title: Spatial organization of the bone marrow niche
order: 4
featured: false
future: true
draft: false
summary: >-
  Two or three sentences. Shown at the top of the section and on the home page card.
questions:
  - First key question?
  - Second key question?
approaches:
  - Spatial transcriptomics
  - Multiplexed imaging
---

Optional longer description in plain paragraphs.
```

- `order` sets the position on the Research page.
- `featured: true` shows the area as a **Current Projects** card on the home page (the first three are used).
- `future: true` adds a "Future direction" tag.
- `draft: true` hides the area without deleting it.
- Describe questions and methods only, not unpublished results.

---

## Add a paper

All publications live in one file: [`src/data/publications.bib`](src/data/publications.bib). The Publications page,
the home page list, the collaborator counts, and the Concepts graph all update from it automatically.

1. Get a BibTeX entry for the paper. Easiest: open the paper on **PubMed → Cite → Format: BibTeX** (or go to
   `https://doi.org/` + the DOI in a tool such as Zotero and export BibTeX).
2. Paste it anywhere in `publications.bib` (order doesn't matter; the site sorts by year).
3. Make sure it has at least `title`, `author`, `journal`, `year`, and ideally `doi` and `pmid`:

```bibtex
@article{doe2026example,
  title   = {An example title about multiple myeloma},
  author  = {Doe, Jane and Smith, Jackson and Szalat, Raphael E.},
  journal = {Blood},
  year    = {2026},
  volume  = {147},
  number  = {3},
  pages   = {100-110},
  doi     = {10.1182/blood.2026000000},
  pmid    = {40000000},
}
```

- The text before the first comma (`doe2026example`) must be unique in the file.
- Separate authors with `and`; write each as `Surname, Given names`.
- **Meeting abstracts and posters:** add `note = {Abstract},`. They are listed in the separate
  "Abstracts & posters" section instead of "Papers".
- Lines starting with `% TODO` mark entries that still need a human check. Delete the line once checked.
- **Concepts:** run `node scripts/add-topics.mjs src/data/publications.bib` (see [For developers](#for-developers))
  to fetch subject terms from PubMed, or add a line yourself:
  `topics = {Multiple Myeloma; Single-Cell Analysis; Bone Marrow},`

---

## Feature a paper on the home page

The home page "Selected publications" list shows every entry with `keywords = {featured}`. Add or remove that line
on an entry in `publications.bib`:

```bibtex
  doi      = {10.1200/jco.22.00643},
  keywords = {featured},
}
```

---

## Add a collaborator

Collaborators are listed in [`src/content/collaborators.yaml`](src/content/collaborators.yaml) and grouped by
institution on the People page. Copy a block and edit it (keep the two-space indentation):

```yaml
- id: doe
  name: Jane Doe
  institution: Example University
  match: ["Doe, J"]
  url: https://example.org/doe
```

- `match` is how the name appears in `publications.bib` (surname + first initial). It is used to count shared
  publications automatically.
- People with fewer than 3 shared publications are hidden; change `MIN_SHARED` in `src/lib/collaborators.ts` to adjust.

---

## Add or change a concept

The Concepts graph comes from [`src/content/concepts.yaml`](src/content/concepts.yaml). A paper belongs to a concept
when its title or `topics` contains one of the `match` phrases (capitalization and accents are ignored; a phrase
also matches longer words, so `transplant` matches "transplantation").

```yaml
- id: single-cell
  label: Single-cell profiling
  group: genomics
  match: ["single-cell", "single cell", "scrna"]
```

`group` sets the color: `disease`, `genomics`, `biology`, `clinical`, or `population`. Concepts linked to fewer than
three works get their own page but are not drawn in the graph.

---

## Change site-wide text

[`src/site.config.ts`](src/site.config.ts) holds the lab name, mission sentence, home page overview, contact email,
affiliations, and the navigation menu.

---

## For developers

**Stack:** [Astro](https://astro.build) (static output, TypeScript), plain CSS with design tokens in
`src/styles/global.css`, content collections for people, research, collaborators, and concepts, and
`@retorquere/bibtex-parser` for publications. Deployed by GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) to GitHub Pages.

Requires Node.js 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` must finish with no errors or warnings. `npm run preview` serves the built site locally.

**Scripts** (run from the repository root; they need internet access):

- `node scripts/add-topics.mjs src/data/publications.bib`: adds PubMed subject terms (`topics`) to entries that
  have a `pmid` and no `topics` yet.
- `node scripts/scholar-csv-to-bib.mjs <scholar.csv> <out.bib>`: the one-time converter used to create
  `publications.bib` from a Google Scholar export (matches DOIs via ORCID and Crossref). Not needed for
  day-to-day edits; running it overwrites `publications.bib`.
- `node scripts/make-og-image.mjs`: regenerates `public/og-default.png`, the image shown when the site is shared.

**Moving to a custom domain:** in `astro.config.mjs`, set `SITE` to the new address (e.g. `https://szalatlab.org`)
and keep `BASE = '/'`; then add the domain under the repository's **Settings → Pages**. All internal links use
`url()` from `src/lib/url.ts`, so nothing else changes.

See [`CLAUDE.md`](CLAUDE.md) for design rules and conventions.
