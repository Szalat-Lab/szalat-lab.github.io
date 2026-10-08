#!/usr/bin/env node
// One-time converter: Google Scholar CSV export -> src/data/publications.bib
//
// The Scholar export has truncated author lists and no DOIs, so each row is
// matched to a DOI (PI's ORCID works first, then a Crossref title search),
// and full metadata comes from Crossref. PubMed IDs come from NCBI E-utilities.
// Anything that could not be matched confidently gets a `% TODO` comment.
//
// Usage:
//   node scripts/scholar-csv-to-bib.mjs assets-inbox/scholar_export.csv src/data/publications.bib [cache.json]
//
// After running once, publications.bib is the source of truth. Edit it by hand.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [csvPath, outPath, cachePath = 'scholar-enrich-cache.json'] = process.argv.slice(2);
if (!csvPath || !outPath) {
  console.error('usage: scholar-csv-to-bib.mjs <scholar.csv> <out.bib> [cache.json]');
  process.exit(1);
}
const PI_ORCID = '0000-0002-6198-3405';
const PI_SURNAME = 'szalat';

// ---------- HTTP with on-disk cache ----------
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url, delay = 120) {
  if (url in cache) return cache[url];
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(delay * (attempt + 1));
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'szalat-lab-website/0.1 (publication list builder)' },
      });
      if (res.status === 404) return (cache[url] = null);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cache[url] = json;
      return json;
    } catch (err) {
      if (attempt === 3) {
        console.warn(`  ! ${url}: ${err.message}`);
        return null;
      }
    }
  }
}
const saveCache = () => writeFileSync(cachePath, JSON.stringify(cache));

// ---------- CSV ----------
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some(Boolean));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// ---------- text helpers ----------
const fold = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const words = (s) => fold(stripTags(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
function titleSim(scholarTitle, candidate) {
  const truncated = /…|\.\.\.$/.test(scholarTitle);
  const a = words(scholarTitle.replace(/…|\.\.\.$/, ''));
  let b = words(candidate);
  if (truncated) b = b.slice(0, a.length);
  if (!a.length || !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return (2 * inter) / (A.size + B.size);
}
const isAbstractVenue = (v) => /suppl|supplement|abstract|meeting|congress/i.test(v);

// Meeting abstracts published in journal supplements (ASH, EHA, IMS/IMW, ASCO).
function isAbstractWork(work, doi) {
  return (
    /suppl|^S\d/i.test(work.issue ?? '') ||
    /^S\d/.test(work.page ?? '') ||
    /blood\.v\d+\.\d+\.(\d+)\.\1$/.test(doi) || // ASH abstracts, e.g. blood.v128.22.356.356
    ABSTRACT_DOIS.has(doi) ||
    /blood-20\d\d-|blood\.v\d+\.suppl|s2152-2650|j\.clml\.2019\.09\.|hs9\.0000/.test(doi) ||
    /^(OAB|P|PF|PS|PB|EP|S)-?\d+[:\s]/.test(work.title?.[0] ?? '')
  );
}

// Crossref names with given/family split in the wrong place, fixed by hand.
const NAME_FIXES = {
  'Mark Sloan, J.': 'Sloan, J. Mark',
  'Kemal Samur, M.': 'Samur, M. Kemal',
  'Niharika Pillalamarri, Bala': 'Pillalamarri, Bala Niharika',
  'Lakshmi Bandi, Rajya': 'Bandi, Rajya Lakshmi',
  'Avet Loiseau, Herve': 'Avet-Loiseau, Hervé',
};

// Congress abstracts that the patterns above miss.
const ABSTRACT_DOIS = new Set(['10.1016/j.nephro.2014.07.332']);

// Matches reviewed by hand and rejected.
const EXCLUDE_DOIS = {
  '10.1182/blood.2021014410': 'visual-abstract stub of the IgM-MM Blood 2021 paper (listed separately)',
};

// Fallback parse of Scholar's "Journal 32 (1), 111-119, 2018" venue string.
function parseVenue(v) {
  const m = v.match(/^(.*?)\s+(\d+)\s*(?:\(([^)]*)\))?\s*,\s*([^,]+?)\s*,\s*\d{4}$/);
  if (m) return { journal: m[1], volume: m[2], number: m[3], pages: m[4] };
  return { journal: v.replace(/,?\s*\d{4}$/, '') };
}

// ---------- sources ----------
async function orcidWorks() {
  const data = await getJSON(`https://pub.orcid.org/v3.0/${PI_ORCID}/works`);
  return (data?.group ?? []).map((g) => {
    const ids = g['external-ids']['external-id'];
    const pick = (t) => ids.find((e) => e['external-id-type'] === t)?.['external-id-value'];
    const s = g['work-summary'][0];
    return { title: s.title?.title?.value ?? '', doi: pick('doi')?.toLowerCase(), pmid: pick('pmid') };
  });
}

async function crossrefSearch(row, loose = false) {
  const y = Number(row.Year);
  const title = row.Title.replace(/…$/, '');
  // First pass: title + journal within ±1 year. Loose pass: title only, any year.
  const url = loose
    ? `https://api.crossref.org/works?query.title=${encodeURIComponent(title)}&rows=10&select=DOI,title,type,author`
    : `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(`${title} ${parseVenue(row.Venue).journal}`)}&filter=from-pub-date:${y - 1},until-pub-date:${y + 1}&rows=8&select=DOI,title,type,author`;
  const data = await getJSON(url);
  return (data?.message?.items ?? [])
    .filter((it) => it.title?.[0] && !/^(correction|erratum|retraction)/i.test(it.title[0]))
    .filter((it) => it.type !== 'posted-content') // skip preprints
    .map((it) => ({ doi: it.DOI.toLowerCase(), title: it.title[0], authors: it.author ?? [] }));
}

async function crossrefWork(doi) {
  const data = await getJSON(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  return data?.message ?? null;
}

async function pubmedId(doi) {
  const data = await getJSON(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(doi)}[doi]`,
    400, // NCBI allows 3 requests/s without an API key
  );
  const ids = data?.esearchresult?.idlist ?? [];
  return ids.length === 1 ? ids[0] : undefined;
}

// ---------- BibTeX output ----------
const texEscape = (s) => String(s).replace(/([&%$#_])/g, '\\$1').replace(/[{}]/g, '');
function bibKey(firstFamily, year, title, used) {
  const stop = new Set(['a', 'an', 'the', 'of', 'in', 'and', 'for', 'on', 'with', 'to', 'is', 'from']);
  const fam = fold(firstFamily || 'anon').toLowerCase().replace(/[^a-z]/g, '') || 'anon';
  const w = words(title).find((x) => !stop.has(x) && x.length > 2) ?? 'paper';
  let key = `${fam}${year}${w}`;
  for (let i = 0; used.has(key); i++) key = `${fam}${year}${w}${String.fromCharCode(98 + i)}`;
  used.add(key);
  return key;
}

function formatEntry(e) {
  const lines = [];
  for (const t of e.todos) lines.push(`% TODO: ${t}`);
  lines.push(`@${e.type}{${e.key},`);
  const fields = [
    ['title', e.title],
    ['author', e.authors.join(' and ')],
    ['journal', e.journal],
    ['school', e.school],
    ['year', e.year],
    ['volume', e.volume],
    ['number', e.number],
    ['pages', e.pages],
    ['doi', e.doi],
    ['pmid', e.pmid],
    ['note', e.note],
  ];
  for (const [k, v] of fields) if (v) lines.push(`  ${k.padEnd(7)} = {${k === 'doi' ? v : texEscape(v)}},`);
  lines.push('}');
  return lines.join('\n');
}

// ---------- main ----------
const rows = parseCSV(readFileSync(csvPath, 'utf8'));
console.log(`${rows.length} rows in ${csvPath}`);
const works = await orcidWorks();
console.log(`${works.length} ORCID works for the PI`);

const entries = [];
const seenDoi = new Map();
const usedKeys = new Set();
const dupes = [];
const rejected = [];
const report = { orcid: 0, crossref: 0, unmatched: 0, duplicates: 0, pmid: 0 };

for (const [i, row] of rows.entries()) {
  process.stdout.write(`\r${i + 1}/${rows.length}`);
  const todos = [];
  let doi, pmid, source;

  // 1. ORCID (curated by the PI, most reliable)
  const best = works
    .filter((w) => w.doi)
    .map((w) => ({ ...w, sim: titleSim(row.Title, w.title) }))
    .sort((a, b) => b.sim - a.sim)[0];
  if (best && best.sim >= 0.9) {
    doi = best.doi;
    pmid = best.pmid;
    source = 'orcid';
  }

  // 2. Crossref search
  for (const loose of [false, true]) {
    if (doi) break;
    const cands = (await crossrefSearch(row, loose))
      .map((c) => ({
        ...c,
        sim: titleSim(row.Title, c.title),
        hasPI: c.authors.some((a) => fold(a.family ?? '').toLowerCase() === PI_SURNAME),
      }))
      .sort((a, b) => b.sim - a.sim || Number(b.hasPI) - Number(a.hasPI));
    const c = cands[0];
    if (c && (c.sim >= 0.92 || (c.sim >= 0.8 && c.hasPI))) {
      doi = c.doi;
      source = 'crossref';
      if (c.sim < 0.92) todos.push(`title matched loosely (similarity ${c.sim.toFixed(2)}); confirm DOI`);
    }
  }

  if (doi && EXCLUDE_DOIS[doi]) {
    report.duplicates++;
    dupes.push(`${row.Year} ${row.Title.slice(0, 70)} -> ${doi} (excluded: ${EXCLUDE_DOIS[doi]})`);
    continue;
  }
  let entry;
  let work = doi ? await crossrefWork(doi) : null;
  if (work) {
    // Reject a match when the PI is not an author AND the journal disagrees with Scholar.
    const hasPI = (work.author ?? []).some((a) => fold(a.family ?? '').toLowerCase() === PI_SURNAME);
    const journalSim = titleSim(parseVenue(row.Venue).journal, work['container-title']?.[0] ?? '');
    if (!hasPI && journalSim < 0.5) {
      rejected.push(`${row.Year} ${row.Title.slice(0, 70)} -> ${doi} (${work['container-title']?.[0]})`);
      work = null;
    }
  }
  if (work) {
    if (seenDoi.has(doi)) {
      report.duplicates++;
      dupes.push(`${row.Year} ${row.Title.slice(0, 70)} -> ${doi} (same as "${seenDoi.get(doi).slice(0, 50)}")`);
      continue;
    }
    const authors = (work.author ?? [])
      .map((a) => (a.family ? `${a.family}, ${a.given ?? ''}`.trim().replace(/,$/, '') : a.name))
      .filter(Boolean)
      .map((a) => NAME_FIXES[a] ?? a);
    if (!authors.some((a) => fold(a).toLowerCase().startsWith(PI_SURNAME))) {
      todos.push('Szalat not in the Crossref author list (consortium author?); verify');
    }
    const year = work.issued?.['date-parts']?.[0]?.[0] ?? Number(row.Year);
    pmid ??= await pubmedId(doi);
    const thesis = work.type === 'dissertation';
    const abstract = !thesis && (isAbstractVenue(row.Venue) || work.type === 'proceedings-article' || isAbstractWork(work, doi));
    entry = {
      title: stripTags(work.title?.[0] ?? row.Title),
      authors,
      journal: stripTags(work['container-title']?.[0] ?? parseVenue(row.Venue).journal),
      year,
      volume: work.volume,
      number: work.issue,
      pages: work.page,
      doi,
      pmid,
      note: abstract ? 'Abstract' : thesis ? 'Doctoral thesis' : undefined,
      type: thesis ? 'phdthesis' : 'article',
      todos,
    };
    if (thesis) {
      entry.school = parseVenue(row.Venue).journal;
      entry.journal = undefined;
    }
    if (Math.abs(year - Number(row.Year)) > 1) todos.push(`Scholar says ${row.Year}, Crossref says ${year}`);
    report[source]++;
    if (pmid) report.pmid++;
    seenDoi.set(doi, row.Title);
  } else {
    report.unmatched++;
    const v = parseVenue(row.Venue);
    const authors = row.Authors.split(',').map((s) => s.trim()).filter((s) => s && s !== '...');
    const truncated = /\.\.\.\s*$/.test(row.Authors);
    if (truncated) authors.push('others');
    todos.push('no DOI found; author list and details copied from Google Scholar');
    if (truncated) todos.push('author list truncated by Google Scholar');
    if (/…/.test(row.Title)) todos.push('title truncated by Google Scholar');
    entry = {
      title: row.Title.replace(/…$/, '').trim(),
      // Scholar gives "BA Walker"; BibTeX wants "Walker, B. A." or "Walker, BA".
      authors: authors.map((a) => (a === 'others' ? a : a.replace(/^([A-Z]+)\s+(.+)$/, '$2, $1'))),
      journal: v.journal,
      year: Number(row.Year),
      volume: v.volume,
      number: v.number,
      pages: v.pages,
      note: isAbstractVenue(row.Venue) || /^[A-Z][A-Z0-9 ,:()-]{25,}$/.test(row.Title) ? 'Abstract' : undefined,
      type: 'article',
      todos,
    };
  }
  const firstFamily = entry.authors[0]?.split(',')[0] ?? '';
  entry.key = bibKey(firstFamily, entry.year, entry.title, usedKeys);
  entries.push(entry);
  if (i % 10 === 0) saveCache();
}
saveCache();
process.stdout.write('\n');

entries.sort((a, b) => b.year - a.year || a.key.localeCompare(b.key));
const header = `% Szalat Lab publications. This file is the source of truth for the Publications page.
% Generated once from a Google Scholar export (${new Date().toISOString().slice(0, 10)}), enriched with
% ORCID, Crossref, and PubMed metadata. Edit by hand from now on.
%
% To add a paper: copy a BibTeX entry (PubMed "Cite", doi.org, or Zotero export), paste it
% below, and make sure it has title, author, journal, year, and doi (pmid optional).
% Entries marked "% TODO" need a human check.
`;
writeFileSync(outPath, header + '\n' + entries.map(formatEntry).join('\n\n') + '\n');

console.log(`Wrote ${entries.length} entries to ${outPath}`);
console.log(
  `  matched via ORCID: ${report.orcid}, via Crossref: ${report.crossref}, unmatched: ${report.unmatched}, duplicates dropped: ${report.duplicates}, with PMID: ${report.pmid}`,
);
for (const d of dupes) console.log(`  duplicate: ${d}`);
for (const r of rejected) console.log(`  rejected match: ${r}`);
console.log(`  entries with TODOs: ${entries.filter((e) => e.todos.length).length}`);
