// Build public/revues_cairn.json ({ discipline: { code: nom } }) from cairn_revues.csv
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCSV(fs.readFileSync(path.join(root, 'cairn_revues.csv'), 'utf8'));
const header = rows[0].map(h => h.trim());
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const data = rows.slice(1).filter(r => r.length > 1 && r[idx['Code CAIRN']].trim());

// A title shared by several codes gets its sub-title appended so the picker stays unambiguous.
const titleCount = {};
data.forEach(r => {
  const t = r[idx['Titre']].trim();
  titleCount[t] = (titleCount[t] || 0) + 1;
});

const out = {};
const seen = new Set();
data.forEach(r => {
  const code = r[idx['Code CAIRN']].trim();
  if (seen.has(code)) { console.warn('duplicate code', code); return; }
  seen.add(code);
  const titre = r[idx['Titre']].trim();
  const sous = r[idx['Sous-titre']].trim();
  const nom = titleCount[titre] > 1 && sous ? `${titre} — ${sous}` : titre;
  const disciplines = r[idx['Disciplines']].split(';').map(d => d.trim()).filter(Boolean);
  (disciplines.length ? disciplines : ['Non classé']).forEach(d => {
    (out[d] = out[d] || {})[code] = nom;
  });
});

const sorted = {};
Object.keys(out).sort((a, b) => a.localeCompare(b, 'fr')).forEach(d => { sorted[d] = out[d]; });

fs.writeFileSync(path.join(root, 'public/revues_cairn.json'), JSON.stringify(sorted));
console.log('revues:', seen.size, '| disciplines:', Object.keys(sorted).length);
console.log(Object.entries(sorted).map(([d, v]) => `${d}: ${Object.keys(v).length}`).join('\n'));
