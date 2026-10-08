// Builds the concept network for the Concepts page from src/content/concepts.yaml and
// publications.bib. Everything (matching, counts, and node layout) runs at build time.
import { getCollection } from 'astro:content';
import { fold, getPublications, type Publication } from './publications';

/** Concepts linked to fewer works than this are left out of the graph (they still get a page). */
export const MIN_WORKS = 3;
/** Two concepts are connected when at least this many works mention both. */
export const MIN_SHARED = 2;
/** Each concept keeps only its strongest links, to keep the network readable. */
export const LINKS_PER_CONCEPT = 4;

export type ConceptGroup = 'disease' | 'genomics' | 'biology' | 'clinical' | 'population';

export const groupLabels: Record<ConceptGroup, string> = {
  disease: 'Diseases',
  genomics: 'Genomics and omics',
  biology: 'Biology',
  clinical: 'Clinical',
  population: 'Population health',
};

export interface Concept {
  id: string;
  label: string;
  group: ConceptGroup;
  works: Publication[];
}

export interface GraphNode extends Concept {
  x: number;
  y: number;
  r: number;
  neighbors: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  /** Number of works that mention both concepts. */
  weight: number;
  /** Overlap between the two concepts (shared works / works in either), 0–1. */
  strength: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let cache: Concept[] | undefined;

/** Every concept with the works it applies to, most frequent first. */
export async function getConcepts(): Promise<Concept[]> {
  if (cache) return cache;
  const [entries, pubs] = await Promise.all([getCollection('concepts'), getPublications()]);
  const texts = pubs.map((p) => fold(`${p.title} ; ${p.topics.join(' ; ')}`));

  cache = entries
    .map(({ id, data }) => {
      // A phrase must start at a word boundary; it may continue into a longer word.
      const re = new RegExp(`(^|[^a-z0-9])(${data.match.map((m) => escape(fold(m))).join('|')})`);
      return { id, label: data.label, group: data.group, works: pubs.filter((_, i) => re.test(texts[i]!)) };
    })
    .sort((a, b) => b.works.length - a.works.length || a.label.localeCompare(b.label));
  return cache;
}

export interface ConceptGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

/** Concepts as a force-directed network, laid out deterministically. */
export async function getConceptGraph(width = 1000, height = 680): Promise<ConceptGraph> {
  const concepts = (await getConcepts()).filter((c) => c.works.length >= MIN_WORKS);
  const keys = concepts.map((c) => new Set(c.works.map((w) => w.key)));

  const all: GraphEdge[] = [];
  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      let weight = 0;
      for (const k of keys[i]!) if (keys[j]!.has(k)) weight++;
      if (weight < MIN_SHARED) continue;
      const strength = weight / (keys[i]!.size + keys[j]!.size - weight);
      all.push({ source: concepts[i]!.id, target: concepts[j]!.id, weight, strength });
    }
  }
  // Keep an edge if it is among the strongest few for either of its two concepts.
  const keep = new Set<GraphEdge>();
  for (const c of concepts) {
    all
      .filter((e) => e.source === c.id || e.target === c.id)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, LINKS_PER_CONCEPT)
      .forEach((e) => keep.add(e));
  }
  const edges = all.filter((e) => keep.has(e));

  const max = Math.max(...concepts.map((c) => c.works.length));
  const nodes: GraphNode[] = concepts.map((c, i) => {
    // Start on a circle, grouped by color, so the layout is the same on every build.
    const a = (i / concepts.length) * Math.PI * 2;
    return {
      ...c,
      r: 7 + 27 * Math.sqrt(c.works.length / max),
      x: width / 2 + Math.cos(a) * width * 0.3,
      y: height / 2 + Math.sin(a) * height * 0.3,
      neighbors: edges
        .filter((e) => e.source === c.id || e.target === c.id)
        .map((e) => (e.source === c.id ? e.target : e.source)),
    };
  });
  const box = layout(nodes, edges, width, height);
  return { nodes, edges, ...box };
}

/** Approximate label width in SVG units (12px Inter). */
const labelWidth = (n: GraphNode) => n.label.length * 6.4;
/** Footprint used for spacing: the circle plus its label underneath. */
const extent = (n: GraphNode) => Math.max(n.r, labelWidth(n) / 2) + 8;

function layout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): { width: number; height: number } {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const maxS = Math.max(0.01, ...edges.map((e) => e.strength));
  const k = Math.sqrt((width * height) / nodes.length) * 0.35;
  let temp = width / 8;

  for (let step = 0; step < 900; step++) {
    const dx = new Float64Array(nodes.length);
    const dy = new Float64Array(nodes.length);
    // Repulsion between every pair.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let x = a.x - b.x;
        let y = a.y - b.y;
        const d = Math.max(Math.hypot(x, y), 0.01);
        let f = (k * k) / d;
        const minD = extent(a) + extent(b);
        if (d < minD) f += (minD - d) * 4; // keep labels from overlapping
        x /= d;
        y /= d;
        dx[i]! += x * f;
        dy[i]! += y * f;
        dx[j]! -= x * f;
        dy[j]! -= y * f;
      }
    }
    // Attraction along edges, stronger for concepts that share more works.
    for (const e of edges) {
      const i = index.get(e.source)!;
      const j = index.get(e.target)!;
      const a = nodes[i]!;
      const b = nodes[j]!;
      const x = a.x - b.x;
      const y = a.y - b.y;
      const d = Math.max(Math.hypot(x, y), 0.01);
      const f = ((d * d) / k) * (0.15 + 0.85 * (e.strength / maxS));
      dx[i]! -= (x / d) * f;
      dy[i]! -= (y / d) * f;
      dx[j]! += (x / d) * f;
      dy[j]! += (y / d) * f;
    }
    // Gravity toward the center, stretched to the canvas aspect ratio.
    nodes.forEach((n, i) => {
      dx[i]! -= (n.x - width / 2) * 0.15;
      dy[i]! -= (n.y - height / 2) * 0.25;
    });
    nodes.forEach((n, i) => {
      const d = Math.max(Math.hypot(dx[i]!, dy[i]!), 0.01);
      n.x += (dx[i]! / d) * Math.min(d, temp);
      n.y += (dy[i]! / d) * Math.min(d, temp);
    });
    temp = Math.max(0.5, temp * 0.993);
  }

  resolveOverlaps(nodes);

  // Move into view and report the bounding box, so circles and labels keep their size.
  const pad = 16;
  const minX = Math.min(...nodes.map((n) => n.x - extent(n))) - pad;
  const maxX = Math.max(...nodes.map((n) => n.x + extent(n))) + pad;
  const minY = Math.min(...nodes.map((n) => n.y - n.r)) - pad;
  const maxY = Math.max(...nodes.map((n) => n.y + n.r + 18)) + pad;
  for (const n of nodes) {
    n.x = Math.round((n.x - minX) * 10) / 10;
    n.y = Math.round((n.y - minY) * 10) / 10;
  }
  return { width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY) };
}

/** Push apart nodes whose circle-plus-label boxes overlap. */
function resolveOverlaps(nodes: GraphNode[]) {
  const box = (n: GraphNode) => ({
    w: Math.max(2 * n.r, labelWidth(n)) + 12,
    top: n.y - n.r - 4,
    bottom: n.y + n.r + 22,
  });
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const A = box(a);
        const B = box(b);
        const ox = (A.w + B.w) / 2 - Math.abs(a.x - b.x);
        const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // Move along the axis that needs the smaller push.
        if (ox < oy) {
          const s = (a.x < b.x ? -1 : 1) * (ox / 2 + 0.5);
          a.x += s;
          b.x -= s;
        } else {
          const s = (a.y < b.y ? -1 : 1) * (oy / 2 + 0.5);
          a.y += s;
          b.y -= s;
        }
      }
    }
    if (!moved) break;
  }
}
