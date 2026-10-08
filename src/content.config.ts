// Content schemas. Each file in src/content/<collection>/ must match its schema;
// `npm run build` reports exactly which field is wrong if it does not.
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      credentials: z.string().optional(),
      role: z.string(),
      // Controls ordering on the People page: PI first, alumni last.
      group: z.enum(['pi', 'postdoc', 'staff', 'md-phd', 'grad', 'undergrad', 'alumni']),
      order: z.number().default(100),
      // One or two sentences shown on the card; the Markdown body is the full bio.
      shortBio: z.string(),
      photo: image().optional(),
      photoAlt: z.string().optional(),
      // Which part of the photo to keep when cropping to a portrait.
      // "attention" finds the most interesting region (usually the face) automatically.
      photoPosition: z
        .enum(['attention', 'entropy', 'center', 'top', 'bottom', 'left', 'right', 'left top', 'right top', 'left bottom', 'right bottom'])
        .default('attention'),
      // How the name appears in publications.bib, used to bold lab members.
      // "Szalat" matches any Szalat; "Smith, J" matches only Smith with first initial J.
      pubNames: z.array(z.string()).optional(),
      email: z.string().email().optional(),
      orcid: z.string().optional(),
      scholar: z.string().url().optional(),
      github: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      website: z.string().url().optional(),
      alumniNote: z.string().optional(),
    }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    // 2–3 sentences; shown on the Home page cards and at the top of the section.
    summary: z.string(),
    questions: z.array(z.string()).min(1),
    approaches: z.array(z.string()).min(1),
    // Shown as a "Current Projects" card on the Home page (up to three).
    featured: z.boolean().default(false),
    // Marks the area as a future direction.
    future: z.boolean().default(false),
    // Set to true to hide the area without deleting the file.
    draft: z.boolean().default(false),
  }),
});

const collaborators = defineCollection({
  loader: file('src/content/collaborators.yaml'),
  schema: z.object({
    name: z.string(),
    institution: z.string(),
    // How the name appears in publications.bib: "Surname, F" (surname + first initial).
    match: z.array(z.string()).min(1),
    url: z.string().url().optional(),
  }),
});

export const collections = { people, research, collaborators };
