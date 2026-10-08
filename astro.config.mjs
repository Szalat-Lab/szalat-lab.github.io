// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Deployment target. For a GitHub project page use
//   SITE = 'https://<owner>.github.io' and BASE = '/<repo>'.
// For a custom domain use SITE = 'https://example.org' and BASE = '/'.
// Current: organization site from the Szalat-Lab/szalat-lab.github.io repository.
const SITE = 'https://szalat-lab.github.io';
const BASE = '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [sitemap()],
});
