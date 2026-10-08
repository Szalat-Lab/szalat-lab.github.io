// Reads src/data/publications.bib at build time and turns it into display-ready entries.
import { parse, type Creator } from '@retorquere/bibtex-parser';
import { getCollection } from 'astro:content';
import bibText from '../data/publications.bib?raw';

export interface Author {
  /** Display form, e.g. "Szalat RE". */
  name: string;
  isMember: boolean;
}

export interface Publication {
  key: string;
  kind: 'paper' | 'abstract';
  isThesis: boolean;
  title: string;
  authors: Author[];
  /** Shortened list for display: long lists keep the first three, any lab members, and the last author. */
  authorsShort: (Author | 'gap')[];
  /** True when the source only had a partial author list ("et al."). */
  etAl: boolean;
  venue: string;
  year: number;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  pmid?: string;
  featured: boolean;
  /** Lowercase text used by the search box (title, all authors, venue). */
  searchText: string;
}

const fold = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function initials(first = ''): string {
  const f = first.trim();
  if (/^[A-Z]{1,3}$/.test(f)) return f; // already initials, e.g. "RE" from Google Scholar
  return f
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

interface MemberName {
  last: string;
  initial?: string;
}

/** Names of current lab members (not alumni), from each person's `pubNames`. */
async function memberNames(): Promise<MemberName[]> {
  const people = await getCollection('people', (p) => p.data.group !== 'alumni');
  return people.flatMap((p) => {
    const names = p.data.pubNames ?? [p.data.name.split(' ').at(-1)!];
    return names.map((n) => {
      const [last, initial] = n.split(',').map((s) => s.trim());
      return { last: fold(last!), initial: initial?.toUpperCase() };
    });
  });
}

function toAuthor(c: Creator, members: MemberName[]): Author {
  if (c.name) return { name: c.name, isMember: false }; // institutional / consortium author
  const last = c.lastName ?? '';
  const ini = initials(c.firstName);
  const isMember = members.some(
    (m) => fold([c.prefix, last].filter(Boolean).join(' ')) === m.last && (!m.initial || ini.startsWith(m.initial)),
  );
  return { name: [c.prefix, last, ini].filter(Boolean).join(' '), isMember };
}

function shorten(authors: Author[]): (Author | 'gap')[] {
  if (authors.length <= 8) return authors;
  const out: (Author | 'gap')[] = authors.slice(0, 3);
  let shown = 2; // index of the last author already in `out`
  const last = authors.length - 1;
  for (let i = 3; i < last; i++) {
    if (!authors[i]!.isMember) continue;
    if (i > shown + 1) out.push('gap');
    out.push(authors[i]!);
    shown = i;
  }
  if (last > shown + 1) out.push('gap');
  out.push(authors[last]!);
  return out;
}

let cache: Publication[] | undefined;

/** All publications, newest first. */
export async function getPublications(): Promise<Publication[]> {
  if (cache) return cache;
  const lib = parse(bibText, { english: false, sentenceCase: false, caseProtection: false });
  if (lib.errors.length) {
    throw new Error(`publications.bib has errors:\n${lib.errors.map((e) => JSON.stringify(e)).join('\n')}`);
  }
  const members = await memberNames();

  cache = lib.entries
    .map((e): Publication => {
      const f = e.fields as Record<string, unknown>;
      const str = (k: string) => (typeof f[k] === 'string' ? (f[k] as string).replace(/<[^>]+>/g, '').trim() : undefined);
      const creators = ((f.author as Creator[] | undefined) ?? []).filter(Boolean);
      const etAl = creators.some((c) => c.lastName === 'others' || c.name === 'others');
      const authors = creators.filter((c) => c.lastName !== 'others' && c.name !== 'others').map((c) => toAuthor(c, members));
      const keywords = (f.keywords as string[] | undefined) ?? [];
      const isThesis = /thesis/i.test(e.type);
      const venue = str('journal') ?? str('booktitle') ?? str('school') ?? '';
      const title = str('title') ?? '(untitled)';
      return {
        key: e.key,
        kind: /abstract|poster/i.test(str('note') ?? '') ? 'abstract' : 'paper',
        isThesis,
        title,
        authors,
        authorsShort: shorten(authors),
        etAl,
        venue: isThesis ? [str('note'), venue].filter(Boolean).join(', ') : venue,
        year: Number(str('year')) || 0,
        volume: str('volume'),
        number: str('number'),
        pages: str('pages'),
        doi: str('doi'),
        pmid: str('pmid'),
        featured: keywords.some((k) => k.trim().toLowerCase() === 'featured'),
        searchText: fold([title, authors.map((a) => a.name).join(' '), venue].join(' ')),
      };
    })
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  return cache;
}

/** Group a list by year, newest first. */
export function byYear(pubs: Publication[]): [number, Publication[]][] {
  const map = new Map<number, Publication[]>();
  for (const p of pubs) map.set(p.year, [...(map.get(p.year) ?? []), p]);
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}
