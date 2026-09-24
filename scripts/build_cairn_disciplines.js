// Builds public/cairn_disciplines.json ({ "<discipline>": "<cairn id>" }) by reading the
// discipline checkboxes off Cairn's own search page. The ids are what the site's
// `disciplines[n]=` URL parameter expects; the names match public/revues_cairn.json.
// Re-run if Cairn reorganises its disciplines: node scripts/build_cairn_disciplines.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SEARCH = 'https://shs.cairn.info/recherche?lang=fr'
  + '&advancedFilters%5B0%5D%5Bfield%5D=full_text'
  + '&advancedFilters%5B0%5D%5Boperator%5D=and'
  + '&advancedFilters%5B0%5D%5Bvalue%5D=famille';

const normalise = (s) => s.normalize('NFC').replace(/’/g, "'").trim();

(async () => {
  const res = await fetch(SEARCH, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
  });
  if (!res.ok) throw new Error(`Cairn search returned HTTP ${res.status}`);
  const html = await res.text();

  const re = /value="(\d+)"[^>]*?wire:model\.live="currentDisciplines"[\s\S]*?<span class="ml-1">([^<]+)<\/span>/g;
  const found = {};
  for (const m of html.matchAll(re)) found[normalise(m[2])] = m[1];

  const ours = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'public/revues_cairn.json'), 'utf8')));
  const out = {};
  const missing = [];
  ours.forEach(d => {
    const id = found[normalise(d)];
    if (id) out[d] = id; else missing.push(d);
  });

  if (missing.length) console.warn('no Cairn id for:', missing.join(' | '));
  const extra = Object.keys(found).filter(d => !ours.some(o => normalise(o) === d));
  if (extra.length) console.warn('on Cairn but not in our corpus:', extra.join(' | '));

  fs.writeFileSync(path.join(root, 'public/cairn_disciplines.json'), JSON.stringify(out, null, 1));
  console.log(`${Object.keys(out).length}/${ours.length} disciplines mapped`);
})();
