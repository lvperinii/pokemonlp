// scripts/verify.mjs
// Auditoria: compara, POR SET, as cartas das raridades especificadas
// (UR/IR/SIR/MHR) que existem na TCGdex com as que estão em data/targets.json.
// Também lista todas as raridades distintas por set e avisa se aparecer alguma
// raridade "rara" não classificada (possível tier faltando).

import { readFileSync } from 'node:fs';

const BASE = 'https://api.tcgdex.net/v2';
const LANG = 'pt';

const RARITY_RULES = [
  { code: 'MHR', kw: ['mega hiper rar', 'mega hyper rar'] },
  { code: 'MAR', kw: ['mega ataque rar', 'mega attack rar'] },
  { code: 'SIR', kw: ['ilustração rara especial', 'special illustration rare'] },
  { code: 'IR', kw: ['ilustração rara', 'illustration rare'] },
  { code: 'UR', kw: ['ultra rara', 'ultra rare'] },
  { code: 'HR', kw: ['hiper raro', 'hiper rara', 'hyper rare', 'rara dourada', 'gold'] },
];
function classify(r) {
  const s = (r || '').toLowerCase();
  let best = null, len = 0;
  for (const rule of RARITY_RULES) for (const k of rule.kw) if (s.includes(k) && k.length > len) { best = rule.code; len = k.length; }
  return best;
}
// "parece rara" mas não classificada -> potencial tier de chase faltando
const looksRare = (r) => /rar|ilust|ultra|hiper|ouro|dourad|secre|arco|shiny|imersiv|especial|gold/i.test(r || '');

async function j(path, lang = LANG, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/${lang}${path}`, { headers: { Accept: 'application/json' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i === tries - 1) { if (lang !== 'en') return j(path, 'en', 1); throw e; } await new Promise((x) => setTimeout(x, 400 * (i + 1))); }
  }
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  const run = async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

const data = JSON.parse(readFileSync('data/targets.json', 'utf8'));
// contagem local por set/código
const local = {};
for (const c of data.cards) { if (!c.code) continue; (local[c.setId] ||= {})[c.code] = ((local[c.setId] || {})[c.code] || 0) + 1; }
const localIdsBySet = {};
for (const c of data.cards) (localIdsBySet[c.setId] ||= new Set()).add(c.id);

// descobre o bloco na TCGdex
const series = await j('/series');
const mega = (series || []).find((s) => (s.name || '').toLowerCase().includes('mega'));
const detail = await j(`/series/${mega.id}`);
const sets = detail.sets || [];

const CODES = ['UR', 'IR', 'SIR', 'MHR'];
let allOk = true;
const missingExamples = [];
const unclassifiedRare = new Set();

console.log('SET        | cartas | oficial |  UR (t/l) |  IR (t/l) | SIR (t/l) | MHR (t/l) | ok');
console.log('-----------+--------+---------+-----------+-----------+-----------+-----------+----');

for (const st of sets) {
  const sd = await j(`/sets/${st.id}`);
  const briefs = sd?.cards || [];
  const details = (await mapLimit(briefs, 12, (b) => j(`/cards/${b.id}`))).filter(Boolean);

  // histograma de raridades da TCGdex neste set
  const tcg = {}; // code -> [ids]
  const rarStrings = new Map();
  for (const c of details) {
    rarStrings.set(c.rarity || '(sem)', (rarStrings.get(c.rarity || '(sem)') || 0) + 1);
    const code = classify(c.rarity);
    if (code) (tcg[code] ||= []).push(c.id);
    else if (c.rarity && looksRare(c.rarity)) unclassifiedRare.add(c.rarity);
  }

  const localSet = local[st.id] || {};
  const localIds = localIdsBySet[st.id] || new Set();
  let ok = true;
  const cell = (code) => {
    const t = (tcg[code] || []).length;
    const l = localSet[code] || 0;
    if (t !== l) ok = false;
    // detecta ids específicos presentes na TCGdex e ausentes no targets.json
    for (const id of (tcg[code] || [])) if (!localIds.has(id)) missingExamples.push(`${id} (${code})`);
    return `${String(t).padStart(3)}/${String(l).padStart(3)}`;
  };
  const cells = CODES.map(cell).join(' | ');
  if (!ok) allOk = false;
  console.log(`${st.id.padEnd(10)} | ${String(details.length).padStart(6)} | ${String(st.cardCount?.total ?? '?').padStart(7)} | ${cells} | ${ok ? 'OK' : 'FALHA'}`);
}

console.log('\n(t = contagem na TCGdex | l = contagem no targets.json)');
if (unclassifiedRare.size) {
  console.log('\n⚠ Raridades que "parecem raras" mas NÃO foram classificadas (revisar se algum tier falta):');
  for (const r of unclassifiedRare) console.log('   -', r);
} else {
  console.log('\n✓ Nenhuma raridade "rara" ficou sem classificar.');
}
if (missingExamples.length) {
  console.log(`\n✗ CARTAS CHASE NA TCGDEX AUSENTES DO targets.json (${missingExamples.length}):`);
  for (const m of missingExamples.slice(0, 40)) console.log('   -', m);
} else {
  console.log('\n✓ Toda carta chase (UR/IR/SIR/MHR) da TCGdex está no targets.json.');
}
console.log('\nRESULTADO:', allOk && !missingExamples.length ? 'PASS — contagens batem em todos os sets.' : 'ATENÇÃO — há divergência (ver acima).');
process.exit(allOk && !missingExamples.length ? 0 : 1);
