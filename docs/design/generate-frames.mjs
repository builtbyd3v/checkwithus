// Original vector handoff assets. Run: node docs/design/generate-frames.mjs
// Created after implementation, not evidence of an earlier design process.
import { mkdir, writeFile } from 'node:fs/promises';

const base = new URL('./', import.meta.url);
await mkdir(base, { recursive: true });
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const screens = [
  { id: 'home', name: 'Older adult: Home', title: ["You're safe"], note: ['Your family is looking', 'out for you.'], symbol: '✓', action: 'Ask my family', secondary: 'Pay a bill', state: 'safe' },
  { id: 'paused', name: 'Older adult: Paused', title: ['Paused'], note: ['Your money is safe.', 'Your family will call you.'], symbol: 'Ⅱ', action: 'OK', state: 'paused', card: ['$500.00', 'Demo Gift Cards', 'A gift card during a call'] },
  { id: 'asked', name: 'Older adult: Ask my family', title: ['We told', 'your family'], note: ['Someone will call', 'you soon.'], symbol: '✓', action: 'OK', state: 'safe' },
  { id: 'lock-screen', name: 'Older adult: Lock-screen card', title: ['Payment paused'], note: ['Your family is checking.', 'Your money is safe.'], symbol: 'Ⅱ', state: 'paused', card: ['$500.00', 'Waiting for family'] },
  { id: 'family-approval', name: 'Family: Approval', title: ['$500.00'], note: ['Demo Gift Cards', 'Rosa is paying'], symbol: 'Ⅱ', state: 'paused', card: ['Why we paused it', 'Gift card purchase', 'Paid while on a call', 'Call Rosa before deciding.'], family: true },
  { id: 'dashboard', name: 'Family: Dashboard', title: ['Looking out', 'for Rosa'], note: ['1 payment waiting', '$500.00 · Demo Gift Cards'], symbol: 'Ⅱ', state: 'paused', card: ['Cash, then a gift card', '$200 cash · 14:30 UTC', '$500 gift card · 15:00 UTC', 'Within two hours'], family: true },
];

function frame(screen, stage) {
  const final = stage === 'final';
  const sketch = stage === 'sketch';
  const ink = final ? '#1c2926' : '#292929';
  const accent = final ? screen.state === 'safe' ? '#115e59' : '#92400e' : '#555555';
  const paper = final ? '#f7f5f0' : '#ffffff';
  const border = sketch ? 'stroke-dasharray="7 5"' : '';
  const text = (x, y, value, size = 20, weight = 400, color = ink) => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escape(value)}</text>`;
  const box = (x, y, w, h, fill, r = 16) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${final ? '#d6d3d1' : '#777'}" ${border}/>`;
  let svg = box(0, 0, 390, 844, paper, 28) + text(28, 48, 'checkwith.us', 20, 700);
  svg += `<circle cx="195" cy="136" r="46" fill="${final ? screen.state === 'safe' ? '#e6f0eb' : '#fef3c7' : '#eeeeee'}" stroke="${accent}" ${border}/>`;
  svg += text(178, 151, screen.symbol, 42, 700, accent);
  let y = 225;
  for (const line of screen.title) { svg += text(28, y, line, 38, 700); y += 46; }
  y += 10;
  for (const line of screen.note) { svg += text(28, y, line, 22); y += 32; }
  if (screen.card) {
    y += 20;
    svg += box(24, y, 342, screen.card.length * 31 + 34, final ? '#ffffff' : '#f5f5f5');
    y += 34;
    screen.card.forEach((line, index) => { svg += text(42, y, line, index === 0 ? 23 : 18, index === 0 ? 700 : 400); y += 31; });
  }
  if (screen.family) {
    svg += box(24, 704, 164, 72, final ? '#9f1239' : '#dddddd');
    svg += box(202, 704, 164, 72, final ? '#115e59' : '#dddddd');
    svg += text(76, 748, 'Deny', 24, 700, final ? '#ffffff' : ink);
    svg += text(233, 748, 'Approve', 24, 700, final ? '#ffffff' : ink);
  } else if (screen.action) {
    svg += box(24, 680, 342, 80, final ? '#115e59' : '#dddddd');
    svg += text(screen.action === 'Ask my family' ? 94 : 176, 730, screen.action, 25, 700, final ? '#ffffff' : ink);
    if (screen.secondary) svg += text(144, 804, screen.secondary, 21, 700, accent);
  } else {
    svg += text(28, 744, 'Updates while the phone app polls.', 17);
  }
  svg += text(28, 826, final ? 'Visual specification · synthetic data' : sketch ? 'New exploratory sketch · Oct 17' : 'New wireframe · Oct 17', 13, 400, '#555555');
  return svg;
}

for (const screen of screens) {
  await writeFile(new URL(`${screen.id}.svg`, base), `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" role="img" aria-label="${escape(screen.name)} visual specification"><title>${escape(screen.name)}</title>${frame(screen, 'final')}</svg>\n`);
}
for (const stage of ['sketch', 'wireframe', 'final']) {
  let board = '<rect width="1280" height="2070" fill="#eeecea"/><text x="40" y="48" font-family="Arial" font-size="28" font-weight="700">checkwith.us · ' + stage + '</text>';
  board += '<text x="40" y="80" font-family="Arial" font-size="18">Created Oct 17 after implementation. New design exploration, not historical process evidence.</text>';
  for (const [index, screen] of screens.entries()) {
    const x = 40 + index % 3 * 415;
    const y = 140 + Math.floor(index / 3) * 950;
    board += `<text x="${x}" y="${y - 14}" font-family="Arial" font-size="18" font-weight="700">${escape(screen.name)}</text><g transform="translate(${x},${y})">${frame(screen, stage)}</g>`;
  }
  await writeFile(new URL(`${stage}-board.svg`, base), `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="2070" viewBox="0 0 1280 2070"><title>checkwith.us ${stage} design board</title>${board}</svg>\n`);
}
console.log('Wrote six Figma-importable SVG frames and three labelled design boards.');
