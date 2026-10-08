#!/usr/bin/env node
// Adds a `topics = {...}` field to publications.bib entries that have a PubMed ID, using the
// paper's MeSH descriptors and author keywords from PubMed. Entries that already have
// `topics` are left alone, so hand edits are kept. Topics feed the Concepts page.
//
// Usage: node scripts/add-topics.mjs src/data/publications.bib

import { readFileSync, writeFileSync } from 'node:fs';

const [bibPath] = process.argv.slice(2);
if (!bibPath) {
  console.error('usage: add-topics.mjs <publications.bib>');
  process.exit(1);
}

// MeSH "check tags" and other descriptors that say nothing about the subject of a paper.
const SKIP = new Set(
  [
    'Humans', 'Male', 'Female', 'Aged', 'Adult', 'Middle Aged', 'Young Adult', 'Adolescent', 'Child',
    'Aged, 80 and over', 'Animals', 'Mice', 'Retrospective Studies', 'Prospective Studies', 'Cohort Studies',
    'Follow-Up Studies', 'Treatment Outcome', 'Prognosis', 'Cell Line, Tumor', 'United States', 'Risk Factors',
    'Incidence', 'Prevalence', 'Time Factors', 'Cross-Sectional Studies', 'Case-Control Studies', 'France',
  ].map((s) => s.toLowerCase()),
);

let bib = readFileSync(bibPath, 'utf8');
const entryRe = /@(\w+)\{([^,]+),\n([\s\S]*?)\n\}/g;
const todo = [];
for (const m of bib.matchAll(entryRe)) {
  const body = m[3];
  const pmid = body.match(/^\s*pmid\s*=\s*\{(\d+)\}/m)?.[1];
  if (pmid && !/^\s*topics\s*=/m.test(body)) todo.push({ key: m[2], pmid });
}
console.log(`${todo.length} entries need topics`);

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

const topicsByPmid = new Map();
for (let i = 0; i < todo.length; i += 50) {
  const ids = todo.slice(i, i + 50).map((t) => t.pmid);
  const res = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(',')}`,
    { headers: { 'User-Agent': 'szalat-lab-website/0.1' } },
  );
  if (!res.ok) throw new Error(`PubMed HTTP ${res.status}`);
  const xml = await res.text();
  for (const art of xml.split('<PubmedArticle>').slice(1)) {
    const pmid = art.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const terms = [
      ...[...art.matchAll(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g)].map((x) => x[1]),
      ...[...art.matchAll(/<Keyword[^>]*>([^<]+)<\/Keyword>/g)].map((x) => x[1]),
    ]
      .map((t) => decode(t).trim())
      .filter((t) => t && !SKIP.has(t.toLowerCase()));
    const seen = new Set();
    topicsByPmid.set(
      pmid,
      terms.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())),
    );
  }
  await new Promise((r) => setTimeout(r, 400));
}

let added = 0;
bib = bib.replace(entryRe, (whole, type, key, body) => {
  const pmid = body.match(/^\s*pmid\s*=\s*\{(\d+)\}/m)?.[1];
  const topics = pmid && topicsByPmid.get(pmid);
  if (!topics?.length || /^\s*topics\s*=/m.test(body)) return whole;
  added++;
  const value = topics.join('; ').replace(/([&%$#_])/g, '\\$1').replace(/[{}]/g, '');
  return `@${type}{${key},\n${body}\n  topics  = {${value}},\n}`;
});
writeFileSync(bibPath, bib);
console.log(`added topics to ${added} entries`);
