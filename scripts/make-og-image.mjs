#!/usr/bin/env node
// Renders public/og-default.png (1200x630), the preview image shown when the site is shared.
// Uses sharp, which is installed with Astro. Re-run after changing the lab name or tagline.
//
// Usage: node scripts/make-og-image.mjs

import sharp from 'sharp';

const W = 1200;
const H = 630;
const colors = ['#5cd6cb', '#a78bfa', '#f5b84b', '#f27d72', '#5dadec', '#9bd86a', '#e879b9'];

// Deterministic point cloud on the right side.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const clusters = [
  [860, 170, 50, 30], [1010, 140, 34, 26], [1060, 280, 46, 36], [900, 320, 42, 24],
  [780, 400, 30, 40], [1000, 440, 52, 28], [1110, 420, 22, 30],
];
let dots = '';
clusters.forEach(([cx, cy, sx, sy], i) => {
  for (let k = 0; k < 70; k++) {
    dots += `<circle cx="${(cx + gauss() * sx).toFixed(1)}" cy="${(cy + gauss() * sy).toFixed(1)}" r="3.2" fill="${colors[i]}" opacity="0.85"/>`;
  }
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e8ebee" stroke-opacity="0.05"/></pattern>
    <linearGradient id="fade" x1="0" x2="1"><stop offset="0.35" stop-color="#0b1114"/><stop offset="0.7" stop-color="#0b1114" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0b1114"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${dots}
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <g font-family="Inter, Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="80" y="150" fill="#9ba6b0" font-family="IBM Plex Mono, Menlo, monospace" font-size="22" letter-spacing="2">BOSTON MEDICAL CENTER · BOSTON UNIVERSITY</text>
    <text x="80" y="260" fill="#e8ebee" font-size="96" font-weight="700" letter-spacing="-3">Szalat Lab</text>
    <text x="80" y="340" fill="#e8ebee" font-size="34">Plasma cell disorders, from the</text>
    <text x="80" y="386" fill="#e8ebee" font-size="34">single cell to the clinic.</text>
    <text x="80" y="520" fill="#5cd6cb" font-family="IBM Plex Mono, Menlo, monospace" font-size="24">szalat-lab.github.io</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('public/og-default.png');
console.log('wrote public/og-default.png');
