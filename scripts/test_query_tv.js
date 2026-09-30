// Exercises the /query_tv route the way the app calls it, for every TV corpus,
// resolution and ngram length. Run: node scripts/test_query_tv.js
const BASE = 'https://shiny.ens-paris-saclay.fr/guni/query_tv';
const CHANNELS = ['bfmtv', 'cnews', 'franceinfo'];

const call = async (params) => {
  const url = `${BASE}?${new URLSearchParams(params)}`;
  try {
    const r = await fetch(url);
    const body = (await r.text()).trim();
    return { ok: r.ok, status: r.status, body, url };
  } catch (e) {
    return { ok: false, status: 'ERR', body: e.message, url };
  }
};

const summarise = (body) => {
  const [head, ...rows] = body.split('\n');
  if (!rows.length) return { cols: head, rows: 0 };
  const cols = head.split(',');
  const idx = Object.fromEntries(cols.map((c, i) => [c, i]));
  const cells = rows.map(r => r.split(','));
  const n = cells.reduce((a, c) => a + (+c[idx.n] || 0), 0);
  const total = cells.reduce((a, c) => a + (+c[idx.total] || 0), 0);
  const years = [...new Set(cells.map(c => c[idx.annee]))].sort();
  return { cols: cols.join('|'), rows: cells.length, n, total, years: `${years[0]}–${years[years.length - 1]}` };
};

(async () => {
  let failures = 0;
  const check = (label, cond, detail = '') => {
    if (!cond) failures++;
    console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  };

  for (const corpus of CHANNELS) {
    console.log(`\n=== ${corpus} ===`);
    const r = await call({ corpus, mot: 'politique', from: '1900', to: '2100', resolution: 'annee' });
    if (!r.ok) { check(`annual query`, false, `HTTP ${r.status}: ${r.body.slice(0, 120)}`); continue; }
    const s = summarise(r.body);
    check('annual query', s.rows > 0, `${s.rows} rows, years ${s.years}, n=${s.n}, corpus=${s.total.toLocaleString()} words, cols=${s.cols}`);

    for (const resolution of ['mois', 'jour']) {
      const rr = await call({ corpus, mot: 'politique', from: '2026', to: '2026', resolution });
      const ss = rr.ok ? summarise(rr.body) : null;
      check(`resolution=${resolution}`, rr.ok && ss.rows > 0, rr.ok ? `${ss.rows} rows, cols=${ss.cols}` : `HTTP ${rr.status}`);
    }

    for (const [label, mot] of [['unigram', 'crise'], ['bigram', 'crise politique'], ['trigram', 'la crise politique']]) {
      const rr = await call({ corpus, mot, from: '2026', to: '2026', resolution: 'annee' });
      check(label, rr.ok, rr.ok ? `n=${summarise(rr.body).n}` : `HTTP ${rr.status}: ${rr.body.slice(0, 80)}`);
    }

    // A word that cannot occur must still return the corpus totals, not an empty body.
    const zero = await call({ corpus, mot: 'zzzzqqqx', from: '2026', to: '2026', resolution: 'annee' });
    const zs = zero.ok ? summarise(zero.body) : null;
    check('unknown word returns totals with n=0', zero.ok && zs.rows > 0 && zs.n === 0,
      zero.ok ? `rows=${zs.rows}, n=${zs.n}` : `HTTP ${zero.status}`);
  }

  console.log('\n=== error handling ===');
  const bad = await call({ corpus: 'tf1', mot: 'politique' });
  check('unknown corpus rejected', bad.status === 400, `HTTP ${bad.status}: ${bad.body.slice(0, 80)}`);
  const long = await call({ corpus: 'bfmtv', mot: 'un deux trois quatre' });
  check('4-word ngram rejected', long.status === 400, `HTTP ${long.status}: ${long.body.slice(0, 80)}`);
  const badres = await call({ corpus: 'bfmtv', mot: 'politique', resolution: 'semaine' });
  check('bad resolution rejected', badres.status === 400, `HTTP ${badres.status}: ${badres.body.slice(0, 80)}`);

  console.log(`\n${failures === 0 ? 'all checks passed' : failures + ' check(s) failed'}`);
  process.exit(failures === 0 ? 0 : 1);
})();
