// Content schemas. Each Markdown file in src/content/<collection>/ must match its schema;
// `npm run build` reports exactly which field is wrong if it does not.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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
      photo: image().optional(),
      photoAlt: z.string().optional(),
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

export const collections = { people };
