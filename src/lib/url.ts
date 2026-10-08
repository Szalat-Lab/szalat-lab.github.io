// Build a link that works under any `base` (e.g. /szalat-lab/ on GitHub Pages, / on a custom domain).
// Always use this for internal links instead of writing "/people/" directly.
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return base + path.replace(/^\//, '');
}
