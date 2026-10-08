// @ts-check
import { defineConfig } from 'astro/config';

// Deployment target. For a GitHub project page use
//   SITE = 'https://<owner>.github.io' and BASE = '/<repo>'.
// For a custom domain use SITE = 'https://example.org' and BASE = '/'.
// TODO: replace <owner>/<repo> once the GitHub repository exists.
const SITE = 'https://OWNER.github.io';
const BASE = '/szalat-lab';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  output: 'static',
});
