// Groups collaborators by institution and counts shared publications from publications.bib.
import { getCollection } from 'astro:content';
import { getPublications, nameKey } from './publications';

/** Collaborators with fewer shared publications than this are not shown. */
export const MIN_SHARED = 3;

export interface Collaborator {
  name: string;
  url?: string;
  shared: number;
}

export interface InstitutionGroup {
  institution: string;
  total: number;
  people: Collaborator[];
}

export async function getCollaboratorGroups(): Promise<InstitutionGroup[]> {
  const [entries, pubs] = await Promise.all([getCollection('collaborators'), getPublications()]);
  const groups = new Map<string, InstitutionGroup>();

  for (const { data } of entries) {
    const keys = new Set(
      data.match.map((m) => {
        const [surname = '', first = ''] = m.split(',').map((s) => s.trim());
        return nameKey(surname, first);
      }),
    );
    const shared = pubs.filter((p) => p.authorKeys.some((k) => keys.has(k))).length;
    if (shared < MIN_SHARED) continue;

    const group = groups.get(data.institution) ?? { institution: data.institution, total: 0, people: [] };
    group.people.push({ name: data.name, url: data.url, shared });
    group.total += shared;
    groups.set(data.institution, group);
  }

  for (const g of groups.values()) g.people.sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name));
  return [...groups.values()].sort((a, b) => b.total - a.total);
}
